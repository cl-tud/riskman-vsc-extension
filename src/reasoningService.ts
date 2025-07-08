import { exec, spawnSync } from 'child_process'

import * as vscode from 'vscode'

import { NAMESPACES } from './Namespaces'

import * as rdf from 'rdflib'

import * as fs from 'fs'

import { getRdfGraph } from './rdfReader'

const initPath = 'total-triples.ttl'
export const triplesAfterInferencePath = 'triples-inference.ttl'
const nemoInput = 'nemo-input.rls'

// export function saveStatements(extensionUri: vscode.Uri, rdfStore: rdf.Store) {
//     // const tmpStore = rdf.graph()

//     const outputPath = vscode.Uri.joinPath(extensionUri, 'nmo', initPath)

//     statements.forEach(st => tmpStore.add(st.subject, st.predicate, st.object))
//     const turtleData = rdf.serialize(null, tmpStore, 'text/turtle')

//     if(turtleData) {
//         fs.writeFileSync(outputPath.path, turtleData)
//     }
// }

function save(graph: rdf.Store, path: string) {
    const turtleData = rdf.serialize(null, graph, null, 'text/turtle')

    if (turtleData) {
        fs.writeFileSync(path, turtleData)
    }
}

export function runBashScript(extensionUri: vscode.Uri, rdfStore: rdf.Store) {

    const totalGraph = rdf.graph()
    rdfStore.statements.forEach(st => {
        totalGraph.add(st.subject, st.predicate, st.object)
    })

    // TODO: temporary comment it out 
    // read store with the riskman ontology
    const riskmanOntology = vscode.Uri.joinPath(extensionUri, 'nmo', 'riskman-ontology.ttl')
    const riskmanOntologyStore = getRdfGraph(riskmanOntology.path, 'text/turtle')
    riskmanOntologyStore.statements.forEach(st => {
        totalGraph.add(st.subject, st.predicate, st.object)
    })

    // read store with the probability-severity ontology
    const probSevOntology = vscode.Uri.joinPath(extensionUri, 'nmo', 'prob5-sev5.ttl')
    const probSevOntologyStore = getRdfGraph(probSevOntology.path, 'text/turtle')
    probSevOntologyStore.statements.forEach(st => {
        totalGraph.add(st.subject, st.predicate, st.object)
    })

    const outputPath = vscode.Uri.joinPath(extensionUri, 'nmo', initPath)

    save(totalGraph, outputPath.path)

    const nemoRulesPath = vscode.Uri.joinPath(extensionUri, 'nmo', 'rules.rls')
    const rulesFileContents = fs.readFileSync(nemoRulesPath.path, 'utf8')

    const lineToAppend = `@import TRIPLE :- turtle { resource = "${outputPath.path}" } .`
    const updatedContent = lineToAppend + '\n' + rulesFileContents

    const nemoInputFilePath = vscode.Uri.joinPath(extensionUri, 'nmo', nemoInput)
    fs.writeFileSync(nemoInputFilePath.path, updatedContent, 'utf8')

    // run bash script
    const config = vscode.workspace.getConfiguration('riskman');

    const nmoOutputPath = vscode.Uri.joinPath(extensionUri, 'nmo')

    // ./nmo epic-rules-hardcoded.rls --overwrite-results --export-dir /home/piotr/Dresden/riskman-vscode-extension/riskman/nmo
    const command = `${config.nemoPath} ${nemoInputFilePath.path} --overwrite-results --export-dir ${nmoOutputPath.path}`

    const result = spawnSync(config.nemoPath, [
        nemoInputFilePath.path,
        '--overwrite-results',
        '--export-dir',
        nmoOutputPath.path
    ], { encoding: 'utf-8' });

    const nmoOutputFile = vscode.Uri.joinPath(extensionUri, 'nmo', 'inferProbability.ttl')
    const inferredStore = getRdfGraph(nmoOutputFile.path, 'text/turtle')

    inferredStore.statements.forEach(st => {
        totalGraph.add(st.subject, st.predicate, st.object)
    })

    const finalOutputPath = vscode.Uri.joinPath(extensionUri, 'nmo', triplesAfterInferencePath)
    save(totalGraph, finalOutputPath.path)

    return inferredStore

}