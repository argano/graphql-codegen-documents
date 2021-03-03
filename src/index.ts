import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import { RawTypesConfig } from '@graphql-codegen/visitor-plugin-common';
import { GraphQLSchema, parse, printSchema, visit, concatAST } from 'graphql';
import { DocumentsGeneratorVisitor } from './visitor';
import { OperationsVisitor } from './operations-visitor';
export * from './visitor';
export { DocumentsGeneratorVisitor };

export interface DocsGenPluginConfig extends RawTypesConfig {
  /**
   * @name recursionLimit
   * @type number
   * @description Will limit the number of nested objects when an object has one or more fields,
   *  that has the same type as the object like `type Person { parent: Person }`
   * @default 5
   *
   * @example
   * ```yml
   * generates:
   * path/to/file.graphql:
   *  plugins:
   *    - graphql-codegen-documents
   *  config:
   *    recursionLimit: 7
   * ```
  */
  recursionLimit?: number;
}

export const plugin: PluginFunction<DocsGenPluginConfig> = (schema: GraphQLSchema, documents: Types.DocumentFile[], config: DocsGenPluginConfig) => {
  const docAstNode = concatAST(
    documents.reduce((prev, v) => {
      return [...prev, v.document];
    }, [])
  );
  const printedSchema = printSchema(schema);
  const astNode = parse(printedSchema);
  const visitor = new DocumentsGeneratorVisitor(schema, [], config, documents);
  const docVisitor = new OperationsVisitor(schema, [], config, documents);
  visit(astNode, { leave: visitor });
  visit(docAstNode, {leave: docVisitor});
  return visitor.generateDocuments(docVisitor.getOperationNames());
};
