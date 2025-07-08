import * as rdf from 'rdflib'
import * as fs from 'fs'
import * as cheerio from 'cheerio'
import { ObjectType } from 'rdflib/lib/types'

// import { Statement } from 'rdflib'

import * as vscode from 'vscode'

import { ImplementationManifest } from './ImplementationManifestTreeDataProvider'
import { VisEdge, VisGraph, VisNode } from './VisJsClasses'


import { NAMESPACES } from './Namespaces'

const DEFAULT_URI = NAMESPACES['ex']

const RDFS_NAMESPACE = rdf.Namespace(NAMESPACES['rdfs'])

const RDFS_LABEL = RDFS_NAMESPACE('label')


const RISKMAN_ONTOLOGY_URI = NAMESPACES['riskman']
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

export function getRdfGraph(rdfaAbsolutePath: string, fileType: string): rdf.Store {

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

    rdf.parse(fileContentString, rdfGraph, baseURI, fileType)

    return rdfGraph
}

function removeDuplicates(list: any[], properties: any[], initialList: any[] = []) {
    const seen = new Set()
    initialList.forEach(item => {
        const key = properties.map(prop => item[prop]).join('::')
        seen.add(key)
    })

    return list.filter(item => {

        const key = properties.map(prop => item[prop]).join('::') // create a unique key
        if (seen.has(key)) {
            return false
        }
        seen.add(key)
        return true

    })

}

export function getDatagraph(graph: rdf.Store, initialStatements: rdf.Statement[] = []): VisGraph {

    // get all controlled risks, and then recusrively all triples, exhaustively that lead from/to controlled risks and forwards
    
    // controlled risks
    // const rdfGraph =  getRdfGraph(rdfaAbsolutePath, fileType)
    //
    const relevantStatements = graph.statements.filter(triple => triple.predicate.value.startsWith(RISKMAN_ONTOLOGY_URI))
    
    const visNodes = relevantStatements.flatMap(t => [t.subject, t.object]).map(node => new VisNode(node, graph))
    const visEdges = relevantStatements.map(statement => new VisEdge(statement, graph))
    return new VisGraph(
        removeDuplicates(visNodes, ['id'], initialStatements.flatMap(t => [t.subject, t.object]).map(node => new VisNode(node, graph))), 
        removeDuplicates(visEdges, ['from','to','code'], initialStatements.map(statement => new VisEdge(statement, graph)))
    )
    //relevantStatements]
}


export function extractImplementationManifests(rdfaAbsolutePath: string, fileType: string) {

    let rdfGraph = getRdfGraph(rdfaAbsolutePath, fileType)
    // return rdfGraph
    const implementationManifests: ImplementationManifest[] = rdfGraph.statementsMatching(undefined, hasImplementationManifestUri, undefined).map((s) => toImplementationManifest(s.object, rdfGraph))
    
    return implementationManifests

    // debugger
}
