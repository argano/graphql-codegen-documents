## graphql-codegen-documents

GraphQL Code Generator plugin for generating documents.

### Installation
- with NPM `npm install --save graphql-codegen-documents`
- with Yarn: `yarn add graphql-codegen-documents`


### Usage
```yml
generates:
path/to/docs_file.graphql:
 plugins:
   - graphql-codegen-documents
 config:
   recursionLimit: 7
```

#### NOTE
- This plugin is meant to run independently before other plugins that need to use `documents`.

For example, in your `package.json` scripts, add:
```json
{
    "gen": "graphql-codegen -c {your-graphql-codegen-documents-config-file}.yaml && graphql-codegen"
}
```


### TODO
- Allow to use user defined documents.
    - Currently all documents will be generated from scratch.
- Allow to use `directives` (https://www.apollographql.com/docs/graphql-tools/schema-directives/).
- Add tests