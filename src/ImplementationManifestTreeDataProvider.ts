import * as vscode from 'vscode'
import * as rdflib from 'rdflib'
import * as path from 'path'

import * as rdfReader from './rdfReader'


// import {  } from 'rdflib/lib/types'
// import { ObjectType } from 'rdflib/lib/types'




export class ImplementationManifestTreeDataProvider implements vscode.TreeDataProvider<ImplementationManifest> {

    private implementationManifests: ImplementationManifest[]
    private workspaceImplementationManifests: { [id: string]: [string, number, number] }

    constructor(
        private rdfFilePath: string,
        private rdfFileType: string,
        workspaceImplementationManifests: { [id: string]: [string, number, number] }) {

        // this.rdfStore = rdfReader.extractRdf(rdfFilePath, rdfFileType)
        this.implementationManifests = rdfReader.extractImplementationManifests(rdfFilePath, rdfFileType)
        this.workspaceImplementationManifests = workspaceImplementationManifests

        // this.updateImplementationManifestMeta()

    }

    private updateImplementationManifestMeta() {

        // debugger

        this.implementationManifests.forEach(im => {
            if (`@${im.uri}` in this.workspaceImplementationManifests) {
                im.foundIn = this.workspaceImplementationManifests[`@${im.uri}`]
                im.iconPath = ImplementationManifest.checkedIconPath
            } else {
                im.foundIn = undefined
                im.iconPath = ImplementationManifest.uncheckedIconPath

            }
        })


    }

    //
    private _onDidChangeTreeData: vscode.EventEmitter<ImplementationManifest | undefined | null | void> = new vscode.EventEmitter<ImplementationManifest | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ImplementationManifest | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(workspaceImplementationManifests: { [id: string]: [string, number, number] }): ImplementationManifest[] {
        this.workspaceImplementationManifests = workspaceImplementationManifests
        this.updateImplementationManifestMeta()
        this._onDidChangeTreeData.fire();

        return this.implementationManifests.filter(im => !im.foundIn)
    }
    //

    getTreeItem(element: ImplementationManifest): vscode.TreeItem {
        return element
    }

    getChildren(element?: ImplementationManifest): vscode.ProviderResult<ImplementationManifest[]> {

        if (!this.implementationManifests) {
            vscode.window.showInformationMessage('No RDF provided or no implementation manifests found in the provided. Use "Load HTML" or "Load RDF" commands to load the risk documentation file')
            return Promise.resolve([])
        }

        if (element) {
            // what exactly happens here?
            return Promise.resolve([element])

        } else {
            // we are at the root element
            return Promise.resolve(
                this.implementationManifests
            )

        }
    }


}

// export enum TreeItemType {
//     CR,
//     SDA,
//     IM
// }




export class ImplementationManifest extends vscode.TreeItem {

    public readonly tooltip: string
    public foundIn?: [string, number, number]
    public readonly uri: string


    private static checkedIconSinglePath = path.join(__filename, '..', '..', 'images', 'green-check.png')
    // private static checkedIconSinglePath = path.join(__filename, '..', '..', 'images', 'check.svg')
    private static uncheckedIconSinglePath = path.join(__filename, '..', '..', 'images', 'red-cross.png')
    // private static uncheckedIconSinglePath = path.join(__filename, '..', '..', 'images', 'cross.svg')

    public static checkedIconPath = {
        light: this.checkedIconSinglePath,
        dark: this.checkedIconSinglePath
    }
    public static uncheckedIconPath = {
        light: this.uncheckedIconSinglePath,
        dark: this.uncheckedIconSinglePath
    }

    constructor(
        public readonly label: string,
        public readonly collapisbleState: vscode.TreeItemCollapsibleState,
        uri: string,
    ) {
        super(label, collapisbleState)
        this.uri = uri
        this.tooltip = uri

        this.iconPath = ImplementationManifest.uncheckedIconPath // by default
    }
}