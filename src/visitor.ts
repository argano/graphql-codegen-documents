import { buildScalars, LoadedFragment, ParsedScalarsMap } from '@graphql-codegen/visitor-plugin-common';
import * as autobind from 'auto-bind';
import { FieldDefinitionNode, GraphQLSchema, InputValueDefinitionNode, ObjectTypeDefinitionNode, TypeNode, NamedTypeNode, InterfaceTypeDefinitionNode } from 'graphql';
import { DocsGenPluginConfig } from '.';

const TAB = '  ';
const DEFAULT_RECUR_LEVEL = 5;

interface NodeFieldType {
  type: string;
  isNullable: boolean;
  isArray: boolean;
  isScalar: boolean;
}

interface OperationInput {
  nameParts: string[];
  type: NodeFieldType;
}

interface FieldType {
  name: string;
  type?: string;
  inputs: InputValueDefinitionNode[];
}

type InterfaceName = string;

export class DocsGenVisitor {
  readonly recursionLimit: number;
  typeDefsMap: { [name: string]: FieldType[] };
  scalars: ParsedScalarsMap;
  interfaceImplementationsMap: { [objectName: string]: InterfaceName[] };
  interfaceFieldsMap: { [interfaceName: string]: string[] };

  constructor(schema: GraphQLSchema, fragments: LoadedFragment[], rawConfig: DocsGenPluginConfig, documents: any[]) {
    this.recursionLimit = rawConfig.recursionLimit || DEFAULT_RECUR_LEVEL;
    this.scalars = buildScalars(schema, {});
    this.typeDefsMap = {};
    this.interfaceFieldsMap = {};
    this.interfaceImplementationsMap = {};
    autobind(this as any);
  }

  ObjectTypeDefinition(def: ObjectTypeDefinitionNode) {
    if (!def.fields) { return; }
    if (def.interfaces && def.interfaces.length) {
      this.interfaceImplementationsMap[def.name.value] = def.interfaces.map(i => i.name.value);
    }
    this.typeDefsMap[def.name.value] = ([...def.fields] as unknown) as FieldType[];
  }

  FieldDefinition(node: FieldDefinitionNode): FieldType {
    const fieldType = this.parseType(node.type);
    if (this.scalars[fieldType.type]) {
      return { name: node.name.value, inputs: [...node.arguments] };
    }
    return {
      name: node.name.value,
      type: fieldType.type,
      inputs: [...node.arguments]
    };
  }

  InterfaceTypeDefinition(node: InterfaceTypeDefinitionNode) {
    const fields = (node.fields as unknown) as FieldType[];
    this.interfaceFieldsMap[node.name.value] = fields.map(field => field.name);
  }

  generateDocuments(): string {
    this.validateInterfaces();
    const docsSettings = [
      { key: 'Query', operationName: 'query' },
      { key: 'Mutation', operationName: 'mutation' },
      { key: 'subscription', operationName: 'subscription' }
    ];
    const generate = (operations: any, operationType: string) => {
      const results = operations.map(operation => {
        const { codes, operationInputs } = this.formatFieldsAndGetInputs(operation);
        const argsString = this.formatInputStringForOperation(operationInputs);
        return this.wrapBlock(operationType, operation.name, argsString, codes);
      });
      return results.join('\n\n');
    };
    const generatedCode = docsSettings.map(setting => {
      const operations = this.typeDefsMap[setting.key];
      if (!operations) { return; }
      return generate(operations, setting.operationName);
    });
    return generatedCode.join('\n\n\n');
  }

  private formatInputStringForOperation(inputs: OperationInput[]): string {
    let inputString = '';
    const formatType = (nodeType: NodeFieldType): string => {
      let typeValue = nodeType.type;
      if (!nodeType.isNullable) {
        if (nodeType.isArray) {
          typeValue = `[${typeValue}!]!`;
        } else {
          typeValue = `${typeValue}!`;
        }
      } else {
        if (nodeType.isArray) {
          typeValue = `[${typeValue}]`;
        }
      }
      return typeValue;
    };
    if (inputs.length) {
      inputString = (() => {
        const inputsString = inputs.map(input => {
          return ['$' + this.getCamelCase(input.nameParts), formatType(input.type)].join(': ');
        }).join(', ');
        return '(' + inputsString + ')';
      })();
    }
    return inputString;
  }

  private formatInputStringForResolver(names: string[], inputs: string[]): string {
    const argumentsString = names.map(name => {
      return [name, '$' + this.getCamelCase([...inputs, name])].join(': ');
    }).join(', ');
    return '(' + argumentsString + ')';
  }

  private formatFieldsAndGetInputs(
    field: FieldType,
    indentCounter = 0,
    parentTypes: { [type: string]: number } = {},
    parentNames: string[]|null = null
  ): { codes: string, operationInputs: OperationInput[] } {
    const recurCounter = parentTypes[field.type] || 0;
    const isOverRecursionLimit = recurCounter > this.recursionLimit;
    if (isOverRecursionLimit) {
      return { codes: '', operationInputs: [] };
    }
    const newParentTypes = { ...parentTypes, [field.type]: recurCounter + 1 };
    const newParentNames = parentNames ? [...parentNames, field.name] : [];
    indentCounter++;
    const fieldInputsString = field.inputs.length ? this.formatInputStringForResolver(field.inputs.map(input => input.name.value), newParentNames) : '';
    const subFields = this.typeDefsMap[field.type];
    const operationInputs = field.inputs.map((input): OperationInput => {
      return {
        nameParts: [...newParentNames, input.name.value],
        type: this.parseType(input.type)
      };
    });
    if (!subFields) {
      return { codes: `${TAB.repeat(indentCounter)}${field.name}${fieldInputsString}\n`, operationInputs };
    }

    const results = subFields.map(subField => this.formatFieldsAndGetInputs(subField, indentCounter, newParentTypes, newParentNames));
    const innerCode = results.map(r => r.codes).join('');
    const codes = `${TAB.repeat(indentCounter)}${field.name}${fieldInputsString} {\n${innerCode}${TAB.repeat(indentCounter)}}\n`;
    const subFieldInputs = results.map(r => r.operationInputs).reduce((prev, curr) => prev.concat(curr));
    return { codes, operationInputs: [...operationInputs, ...subFieldInputs] };
  }

  private wrapBlock(operationType: string, operationName: string, args: string, code: string): string {
    return `${operationType} ${operationName}${args} { \n${code}}`;
  }

  private parseType(rawType: TypeNode | string): NodeFieldType {
    const typeNode = rawType as TypeNode;
    if (typeNode.kind === 'NamedType') {
      return {
        type: typeNode.name.value,
        isNullable: true,
        isArray: false,
        isScalar: !!this.scalars[typeNode.name.value],
      };
    } else if (typeNode.kind === 'NonNullType') {
      return {
        ...this.parseType(typeNode.type),
        isNullable: false,
      };
    } else if (typeNode.kind === 'ListType') {
      return {
        ...this.parseType(typeNode.type),
        isArray: true,
        isNullable: true,
      };
    }
    throw new Error('error');
  }

  private validateInterfaces(): void {
    Object.keys(this.interfaceImplementationsMap).forEach(k => {
      let fieldsFromInterfaces = [];
      const interfaces = this.interfaceImplementationsMap[k];
      interfaces.forEach(interfaceName => {
        const names = this.interfaceFieldsMap[interfaceName];
        fieldsFromInterfaces = [...fieldsFromInterfaces, ...names];
      });
      const uniqueFields = Array.from(new Set(fieldsFromInterfaces));
      const objectMap: { [name: string]: true } = {};
      this.typeDefsMap[k].forEach(f => { objectMap[f.name] = true; });
      uniqueFields.forEach(field => {
        if (!objectMap[field]) {
          throw new Error('Missing ' + field + ' in ' + k);
        }
      });
    });
  }

  private getCamelCase(arr: string[]): string {
    return [arr[0], ...arr.slice(1).map(str => str.charAt(0).toUpperCase() + str.substring(1))].join('');
  }
}
