import * as rdf from 'rdflib'
import * as fs from 'fs'
import * as cheerio from 'cheerio'
import { ObjectType } from 'rdflib/lib/types'

import * as vscode from 'vscode'

import { ImplementationManifest } from './ImplementationManifestTreeDataProvider'


const DEFAULT_URI = 'http://example.org#'

const RDFS_NAMESPACE = rdf.Namespace('http://www.w3.org/2000/01/rdf-schema#')
const RDFS_LABEL = RDFS_NAMESPACE('label')


const RISKMAN_ONTOLOGY_URI = 'https://w3id.org/riskman/ontology#'
const RISKMAN_ONTOLOGY_NAMESPACE = rdf.Namespace(RISKMAN_ONTOLOGY_URI)
const hasImplementationManifestUri = RISKMAN_ONTOLOGY_NAMESPACE('hasImplementationManifest')


function toImplementationManifest(object: ObjectType, store: rdf.Store): ImplementationManifest {
    return new ImplementationManifest(
        getLabel(object, store),
        vscode.TreeItemCollapsibleState.None,
        object.value
    )
}


function getLabel(object: any, rdfStore: rdf.Store) {
    const label = rdfStore.any(object, RDFS_LABEL, undefined)
    return label?.value || object.value

}



export function extractImplementationManifests(rdfaAbsolutePath: string, fileType: string) {

    const rdfGraph = rdf.graph()
    
    const fileContentString = fs.readFileSync(rdfaAbsolutePath).toString()

    let baseURI = DEFAULT_URI 
    if (fileType == 'text/html') {
        baseURI = cheerio.load(fileContentString)('base').attr('href') || DEFAULT_URI
    } else {
        const baseUriMatch = fileContentString.match(/@base\s+<([^>]+)>|BASE\s+<([^>]+)>/i)
        baseURI = baseUriMatch ? baseUriMatch[1] || baseUriMatch[2] : DEFAULT_URI 
    }

    if (baseURI == DEFAULT_URI) {
        console.warn(`No base URI found, using ${DEFAULT_URI} instead.`)
    }

    rdf.parse(fileContentString, rdfGraph, baseURI, fileType);

    // return rdfGraph
    const implementationManifests: ImplementationManifest[] = rdfGraph.statementsMatching(undefined, hasImplementationManifestUri, undefined).map((s) => toImplementationManifest(s.object, rdfGraph))
    
    return implementationManifests

    // debugger
}
