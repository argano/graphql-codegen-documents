## graphql-codegen-documents

GraphQL Code Generator plugin for generating documents.

### Installation
- with NPM `npm install --save graphql-codegen-documents`
- with Yarn: `yarn add graphql-codegen-documents`


### Usage
NOTE: This plugin is meant to run independently before other plugins that need to use `documents`.

For example, in your `package.json` scripts, add:
```json
{
    "gen": "graphql-codegen -c {your-graphql-codegen-documents-config-file}.yaml && graphql-codegen"
}
```

and in your `your-graphql-codegen-documents-config-file`:
```yml
schema:
  - path/to/schema.graphql
documents:
  - path/to/my-custom-documents.graphql
generates:
  path/to/generated-docs.graphql:
    plugins:
      - graphql-codegen-documents
    config:
      recursionLimit: 7
```

and then your other plugins
```yml
schema:
  - path/to/schema.graphql
documents:
  - path/to/my-custom-documents.graphql
  - path/to/generated-documents.graphql
generates:
  # Other plugins
```

### TODO
- Allow to use user defined documents.
    - Currently all documents will be generated from scratch.
- Allow to use `directives` (https://www.apollographql.com/docs/graphql-tools/schema-directives/).
- Add tests