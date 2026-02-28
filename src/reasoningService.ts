import { exec, spawnSync } from 'child_process'

import * as vscode from 'vscode'

import { NAMESPACES } from './Namespaces'

import * as rdf from 'rdflib'

import * as fs from 'fs'

import { getRdfGraph } from './rdfReader'
import { output } from 'rdflib/lib/utils-js'

const inputPath = 'input-triples.ttl'
export const outputPath = 'output-triples.ttl'

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

    // read store with the riskman ontology, add it to the total graph
    const riskmanOntology = vscode.Uri.joinPath(extensionUri, 'reasoning', 'riskman-ontology.ttl')
    const riskmanOntologyStore = getRdfGraph(riskmanOntology.path, 'text/turtle')
    riskmanOntologyStore.statements.forEach(st => {
        totalGraph.add(st.subject, st.predicate, st.object)
    })

    // read store with the probability-severity ontology, add it to the total graph
    const probSevOntology = vscode.Uri.joinPath(extensionUri, 'reasoning', 'prob5-sev5.ttl')
    const probSevOntologyStore = getRdfGraph(probSevOntology.path, 'text/turtle')
    probSevOntologyStore.statements.forEach(st => {
        totalGraph.add(st.subject, st.predicate, st.object)
    })

    const inputPathFull = vscode.Uri.joinPath(extensionUri, 'reasoning', inputPath)
    const outputPathFull = vscode.Uri.joinPath(extensionUri, 'reasoning', outputPath)

    // save the temporary file
    save(totalGraph, inputPathFull.path)

    // run bash script
    const config = vscode.workspace.getConfiguration('riskman')

    const rawCommand = (config.reasonerCommand as string)
        .replace('{input}', inputPathFull.path)
        .replace('{output}', outputPathFull.path)
    const [cmd, ...args] = rawCommand.split(/\s+/)
    const result = spawnSync(cmd, args, { encoding: 'utf-8' });



    const inferredStore = getRdfGraph(outputPathFull.path, 'text/turtle')

    const riskman = rdf.Namespace(NAMESPACES['riskman'])
    const rdfN = rdf.Namespace(NAMESPACES['rdf'])

    const allowedProps = [
        riskman('hasProbability'),
        riskman('hasProbability1'),
        riskman('hasProbability2'),
        riskman('hasSeverity')
    ]


    //

    const totalDataGraph = rdf.graph()
    rdfStore.statements.forEach(st => {
        totalDataGraph.add(st.subject, st.predicate, st.object)
    })



    // filter out probabilities and severities that are not relevant
    inferredStore.statements.forEach(st => {


        // -------------------------------------------
        // If triple is: X rdf:type Probability|Severity
        // -------------------------------------------
        const isProbSevType =
            st.predicate.equals(rdfN('type')) &&
            (st.object.equals(riskman('Probability')) || st.object.equals(riskman('Severity')));

        if (isProbSevType) {
            // Keep this type triple only if there's a connection:
            // something --allowedProp--> X
            const hasAllowedConnection = inferredStore.match(null, null, st.subject)
                .some(conn => allowedProps.some(p => conn.predicate.equals(p)));

            if (!hasAllowedConnection) {
                // console.log(st)
                return;
            } // skip this type triple
        } else {

            // -------------------------------------------
            // If triple: subj pred obj,
            // and subj is of type Probability|Severity,
            // keep only if predicate is allowed
            // -------------------------------------------
            const subjTypes = inferredStore.match(st.subject, rdfN('type'), null);
            const subjIsProbSev = subjTypes.some(t =>
                t.object.equals(riskman('Probability')) || t.object.equals(riskman('Severity'))
            );

            if (subjIsProbSev && !allowedProps.some(p => st.predicate.equals(p))) {
                // console.log(st)
                return; // skip this triple
            }

        }
        // -------------------------------------------
        // Otherwise: keep the triple
        // -------------------------------------------
        totalDataGraph.add(st.subject, st.predicate, st.object);
    });


    // debugger
    return totalDataGraph

}