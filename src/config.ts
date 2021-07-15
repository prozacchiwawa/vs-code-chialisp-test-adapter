import * as vscode from 'vscode';
import * as path from 'path';

import { isFileExists, readFile } from './utilities';

export class ExtensionConfiguration {
    env : any | undefined;
    constructor(v : any) {
        if (v) {
            this.env = v;
        } else {
            this.env = {};
        }
    }
}

export async function loadExtensionConfiguration(wsfolder : vscode.WorkspaceFolder) : Promise<ExtensionConfiguration> {
    const envPath = path.join(wsfolder.uri.fsPath, '.chia-env');
    const envFileExists = await isFileExists(envPath);
    if (!envFileExists) {
        return new ExtensionConfiguration({});
    }
    const content = await readFile(envPath);
    try {
        const jsonContent = JSON.stringify(content);
        console.log(jsonContent);
        return new ExtensionConfiguration(jsonContent);
    } catch(x) {
        return new ExtensionConfiguration({});
    }
}
