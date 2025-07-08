// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// import * as fg from 'fast-glob'
import * as fsp from 'fs/promises'
import * as fs from 'fs'
import * as readline from 'readline'
import * as rdf from 'rdflib'

import * as path from 'path'

import { ImplementationManifestTreeDataProvider } from './ImplementationManifestTreeDataProvider'

import { GraphPanel } from './GraphPanel'

import { getDatagraph, getRdfGraph  } from './rdfReader'

import { runBashScript } from './reasoningService';

import { validate } from './validationService';



async function getWorkspaceImplementationManifests(workspacePath: string): Promise<{ [id: string]: [string, number, number] }> {

	const filesAndDirectorieslist = await fsp.readdir(workspacePath, { recursive: true });

	const files = filesAndDirectorieslist.filter((file) => fs.lstatSync(path.join(workspacePath, file)).isFile())

	const uriWithAtSignRegex = /@((https?|ftp|file):\/\/([^\s$.?#].[^\s]*))/i;
	let dict: { [id: string]: [string, number, number] } = {};

	for (const fileRelativePath of files) {
		const fileAbsolutePath = path.join(workspacePath, fileRelativePath);
		const fileStream = fs.createReadStream(fileAbsolutePath);

		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity,
		});

		let lineNo = 0;
		for await (const line of rl) {
			lineNo++;

			let match = uriWithAtSignRegex.exec(line);
			if (match) {
				const matchMeta: [string, number, number] = [fileAbsolutePath, lineNo, match.index];
				let matchedString = match[0];
				dict[matchedString] = matchMeta;
			}
		}
	}

	return dict
}


export async function activate(context: vscode.ExtensionContext) {

	let rdfFilePath: string | undefined = undefined
	let rdfFileType: string | undefined = undefined
	let rdfGraph: rdf.Store | undefined = undefined
	let imTreeDataProvider: ImplementationManifestTreeDataProvider | undefined = undefined


	let workspaceImplementationManifests: { [id: string]: [string, number, number] } = {}

	const workspaceFolders = vscode.workspace.workspaceFolders;

	if (!workspaceFolders) {
		vscode.window.showErrorMessage('No workspace folder is open.');
		return;
	}

	const workspacePath = workspaceFolders[0].uri.fsPath;
	workspaceImplementationManifests = await getWorkspaceImplementationManifests(workspacePath)

	async function onAnyChange() {

		workspaceImplementationManifests = await getWorkspaceImplementationManifests(workspacePath)

		const unsatisfiedIMs = imTreeDataProvider?.refresh(workspaceImplementationManifests)

		if (unsatisfiedIMs && unsatisfiedIMs?.length > 0) {
			const unsatErrorMessage = unsatisfiedIMs.map(i => `${i.label} (${i.uri})\n`)
			vscode.window.showErrorMessage(`Implementation manifests not found in the workspace:\n${unsatErrorMessage}`)
		} else {
			vscode.window.showInformationMessage('Success! All implementation manifests found in the workspace.')
		}

	}

	const watcher = vscode.workspace.createFileSystemWatcher('**/*')


	watcher.onDidChange(onAnyChange)
	watcher.onDidCreate(onAnyChange)
	watcher.onDidDelete(onAnyChange)

	context.subscriptions.push(watcher)

	///////////////////////////

	function proceedWithImplementationManifests(fileUris: vscode.Uri[] | undefined, fileType: string) {
		if (fileUris && fileUris[0]) {

			rdfFilePath = fileUris[0].fsPath
			rdfFileType = fileType
			imTreeDataProvider = new ImplementationManifestTreeDataProvider(rdfFilePath, rdfFileType, workspaceImplementationManifests)

			// trigger checks
			onAnyChange()

			vscode.window.registerTreeDataProvider('im-explorer', imTreeDataProvider!)

			const tree = vscode.window.createTreeView('im-explorer', { showCollapseAll: false, treeDataProvider: imTreeDataProvider })


			tree.onDidChangeSelection(e => {
				if (e.selection.length > 0 && e.selection[0].foundIn) {

					const foundIn = e.selection[0].foundIn

					// point to where it is implemented
					const position = new vscode.Position(foundIn[1] - 1, foundIn[2])
					const position2 = new vscode.Position(foundIn[1] - 1, foundIn[2] + e.selection[0].uri.length + 1) // lineNumber is 1-based, so subtract 1

					const range = new vscode.Range(position, position2);
					vscode.window.showTextDocument(vscode.Uri.file(foundIn[0]), { selection: range })


				}
			});
		}
	}

	// 
	function proceedWithGraph(fileUris: vscode.Uri[] | undefined, fileType: string) {

		if (fileUris && fileUris[0]) {

			rdfFilePath = fileUris[0].fsPath
			rdfFileType = fileType

			rdfGraph = getRdfGraph(rdfFilePath, rdfFileType)

			const visGraph = getDatagraph(rdfGraph)

			GraphPanel.createOrShow(context.extensionUri, visGraph)

			// save statements to a file for reasoning
			// saveStatements(context.extensionUri, statements)
		}


	}

	// TODO: this should instead take as an argument a callback that takes a nullable RdfGraph as argument and then callbacks can do something with it
	function loadRdfDialog(fileType: string, callback: (fileUris: vscode.Uri[] | undefined, fileType: string) => void) {

		const HTMLOptions: vscode.OpenDialogOptions = {
			canSelectMany: false,
			openLabel: 'Open',
			filters: {
				'All files': ['*'],
				'HTML files': ['html'],
			}
		}

		const TurtleOptions: vscode.OpenDialogOptions = {
			canSelectMany: false,
			openLabel: 'Open',
			filters: {
				'Turtle files': ['ttl'],
				'All files': ['*']
			}
		}

		const options = fileType == 'text/html' ? HTMLOptions : TurtleOptions

		return () => {
			vscode.window.showOpenDialog(options).then(fileUri => callback(fileUri, fileType))
		}

	}

	const loadHtml = vscode.commands.registerCommand('riskman.loadHTML', loadRdfDialog('text/html', proceedWithImplementationManifests))
	const loadRDF = vscode.commands.registerCommand('riskman.loadRDF', loadRdfDialog('text/turtle', proceedWithImplementationManifests))


	context.subscriptions.push(loadHtml)
	context.subscriptions.push(loadRDF)

	vscode.commands.registerCommand('riskman.refreshEntry', () => {
		if (imTreeDataProvider) imTreeDataProvider?.refresh(workspaceImplementationManifests)
	})

	vscode.commands.registerCommand('riskman.copyURI', async (e) => {
		await vscode.env.clipboard.writeText(e.uri);
		vscode.window.showInformationMessage(`Copied to clipboard: ${e.uri}`);
	})


	// test command
	vscode.commands.registerCommand('riskman.runInference', () => {
		if(rdfGraph) {
			const inferredStore = runBashScript(context.extensionUri, rdfGraph)

			const newVisGraph = getDatagraph(inferredStore, rdfGraph.statements)

			inferredStore.statements.forEach(st => {
				rdfGraph?.add(st.subject, st.predicate, st.object)
			})

			GraphPanel.message({
				type: 'infer',
				data: newVisGraph
			})


		}
	})


	// TODO: move this to another file


	//
	const loadGraph = vscode.commands.registerCommand('riskman.loadGraph', loadRdfDialog('text/html', proceedWithGraph))
	// const loadGraph = vscode.commands.registerCommand('riskman.loadGraph', () => {
		// temporary fix the input file
		// const fileURI = `/home/piotr/Dresden/riskman-vscode-extension/risk-documentations/submission_giip_large.html`
		// const fileURI = `/home/piotr/Dresden/riskman-vscode-extension/risk-documentations/submission_giip_4_residual_prob.html`
		// proceedWithGraph([vscode.Uri.file(fileURI)], 'text/html')
	// })


	context.subscriptions.push(loadGraph)


	context.subscriptions.push(
		vscode.commands.registerCommand('riskman.validate', () => {
			let validationResults = validate(context.extensionUri)

			GraphPanel.message({
				type: 'validate',
				data: validationResults
			})

			if(validationResults.length > 0) {
				let validationMessage = validationResults.map(res => `Node: ${res.focusNode}\nError:${res.message}`).join('\n')

				vscode.window.showErrorMessage(`Validation unsuccessful. ${validationMessage}`);
			} else {
				vscode.window.showInformationMessage(`Validation successful.`);
			}
			
		})
	)

}