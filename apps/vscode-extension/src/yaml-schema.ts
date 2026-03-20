import * as vscode from 'vscode';
import schemaContent from '../../../packages/app-core/schemas/dramark-frontmatter.schema.json';

const SCHEMA_URI = 'dramark://schemas/frontmatter.json';

export function registerYamlSchema(context: vscode.ExtensionContext): void {
  const yamlExtension = vscode.extensions.getExtension('redhat.vscode-yaml');
  if (!yamlExtension) {
    return;
  }

  yamlExtension.activate().then((api) => {
    if (!api || typeof api.registerContributor !== 'function') {
      return;
    }

    api.registerContributor(
      'dramark',
      (resource: string) => {
        const uri = vscode.Uri.parse(resource);
        if (uri.scheme === 'dramark' || uri.path.endsWith('.dramark') || uri.path.endsWith('.drm') || uri.path.endsWith('.drm.md')) {
          return SCHEMA_URI;
        }
        return undefined;
      },
      (uri: string) => {
        if (uri === SCHEMA_URI) {
          return JSON.stringify(schemaContent);
        }
        return undefined;
      },
    );
  });
}
