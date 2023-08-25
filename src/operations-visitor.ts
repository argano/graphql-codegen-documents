import { LoadedFragment } from '@graphql-codegen/visitor-plugin-common';
import * as autoBind from 'auto-bind';
import { GraphQLSchema, OperationDefinitionNode } from 'graphql';
import { DocsGenPluginConfig } from '.';

export class OperationsVisitor {
  queries: string[];
  mutations: string[];
  subscriptions: string[];

  constructor(schema: GraphQLSchema, fragments: LoadedFragment[], rawConfig: DocsGenPluginConfig, documents: any[]) {
    this.queries = [];
    this.mutations = [];
    this.subscriptions = [];
    autoBind(this as any);
  }

  OperationDefinition(node: OperationDefinitionNode) {
    const operationName = node.name.value;
    switch (node.operation) {
      case 'query':
          this.queries.push(operationName);
          break;
      case 'mutation':
        this.mutations.push(operationName);
        break;
      case 'subscription':
        this.subscriptions.push(operationName);
        break;
      default:
        throw new Error('Unknown operation');
    }
  }

  getOperationNames(): {queries: string[]; mutations: string[]; subscriptions: string[]} {
    return {
      queries: this.queries,
      mutations: this.mutations,
      subscriptions: this.subscriptions
    };
  }
}
