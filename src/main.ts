import * as core from '@actions/core';
import { validateYaml } from './yaml-validator';
import { getJson } from './file-reader';
import * as path from 'path';
import * as fs from 'fs';

async function run() {
  try {

    const workspaceRoot = <string>process.env['GITHUB_WORKSPACE'];

    const settingsFile = core.getInput('settingsfile');
    const yamlSchemasJson = core.getInput('yamlSchemasJson');
    const yamlVersionInput = core.getInput('yamlVersion');

    // Settings checking
    let inlineYamlSchemas;
    if (yamlSchemasJson)
    {
      inlineYamlSchemas =  JSON.parse(yamlSchemasJson)
    }

    let settingsYamlSchemas;
    let settingsYamlVersion;
    if (fs.existsSync(path.join(workspaceRoot, settingsFile))){
      const settings  = await getJson(path.join(workspaceRoot, settingsFile));
      settingsYamlSchemas = settings ? settings['yaml.schemas'] : null;
      settingsYamlVersion = settings ? settings['yaml.yamlVersion']: null;
    }
    const schemas = {...settingsYamlSchemas, ...inlineYamlSchemas };

    const yamlVersion = yamlVersionInput ? yamlVersionInput : settingsYamlVersion;

    const validationResults = await validateYaml(workspaceRoot, schemas, yamlVersion);

    const validResults = validationResults.filter(res => res.valid);
    const invalidResults = validationResults.filter(res => !res.valid);

    const validFiles = validResults.length > 0 ? validResults.map(res => res.filePath).join(',') : '';
    const invalidFiles = invalidResults.length > 0 ? invalidResults.map(res => res.filePath).join(',') : '';

    core.setOutput('validFiles', validFiles);
    core.setOutput('invalidFiles', invalidFiles);

    if (invalidResults.length > 0) {
        invalidResults.forEach(function(el) {
          if (el.results?.length > 0) {
            el.results.forEach(function(diag) {
              const { start, end } = diag.range;
              const options = <core.AnnotationProperties>{file: el.filePath};
              options.startLine = start?.line || undefined;
              options.endLine = end?.line || undefined;
              if (start?.line == end?.line && start?.line !== undefined) {
                options.startColumn = start?.character || undefined
                options.endColumn = end?.character || undefined
              }
              core.error(diag.message, options);
            })
          } else {
            core.error('Invalid File', {file: el.filePath});
          }
        })
        core.setFailed('Schema validation failed on one or more YAML files.');
    } else {
        core.info(`✅ YAML Schema validation completed successfully`);
    }

  } catch (error) {
    core.setFailed(error.message);
  }

}

run();
