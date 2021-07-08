// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
// thanks: https://github.com/hbenl/vscode-test-adapter-api
import * as vscode from 'vscode';
import { TestAdapterRegistrar } from 'vscode-test-adapter-util';
import { TestHub, testExplorerExtensionId, TestAdapter, RetireEvent, TestInfo } from 'vscode-test-adapter-api';

import { ChialispTestAdapter } from './testadapter';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const testExplorerExtension = vscode.extensions.getExtension<TestHub>(testExplorerExtensionId);

	if (testExplorerExtension) {
		console.log('have test explorer extension');
		const testHub = testExplorerExtension.exports;

		context.subscriptions.push(new TestAdapterRegistrar(
			testHub,
			workspaceFolder => new ChialispTestAdapter(workspaceFolder)
		));
	}

	let disposable = vscode.commands.registerCommand('chialisp-unittest.run-tests', () => {
		vscode.window.setStatusBarMessage("Discovering tests...");
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
