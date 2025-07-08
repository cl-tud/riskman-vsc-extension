import * as vscode from 'vscode'
import * as rdf from 'rdflib'

import { spawnSync } from 'child_process'

import { triplesAfterInferencePath } from './reasoningService'

import { getRdfGraph } from './rdfReader'
import { NAMESPACES } from './Namespaces'

import { getStringObject, shortenURI } from './VisJsClasses'


import { NamedNode, Term } from 'rdflib/lib/tf-types';


export function validate(extensionUri: vscode.Uri) {


    const config = vscode.workspace.getConfiguration('riskman')

    const finalOutputPath = vscode.Uri.joinPath(extensionUri, 'nmo', triplesAfterInferencePath)
    const shapesPath = vscode.Uri.joinPath(extensionUri, 'nmo', 'riskman-shapes.ttl')
    const validationResult  = vscode.Uri.joinPath(extensionUri, 'nmo', 'validation-result.ttl')
    // const validationResult = 

    // $pyshacl_location -s $shapes_location $data_graph_file -f json-ld)" # "json-ld by" default. Other alternatives: human,turtle,xml,json-ld,nt,n3
    // const command = `${config.pyshaclPath} -s ${shapesPath.path} ${finalOutputPath.path} -f turtle`

    const result = spawnSync(config.pyshaclPath, [
        '-s', shapesPath.path,
        finalOutputPath.path,
        '-f', 'turtle',
        '-o', validationResult.path
    ], { encoding: 'utf-8' })

    const resultsStore = getRdfGraph(validationResult.path, 'text/turtle')


    let validationObjects =  resultsStore.statementsMatching(undefined, rdf.Namespace(NAMESPACES['rdf'])('type'), rdf.Namespace(NAMESPACES['sh'])('ValidationResult')).map(
        (s) => getValidationResults(s.subject, resultsStore)
    )

    return validationObjects
}

function getValidationResults(st: Term, graph: rdf.Store) {
    // get focus node
    // get message
    //   sh:focusNode <http://foo.com/sda0> ;
    //   sh:resultMessage "Every SDA needs a final mitigation (which has the Implementation Manifest)" ;

    const focusNode = getStringObject(st, graph, rdf.Namespace(NAMESPACES['sh'])('focusNode'))
    const message = getStringObject(st, graph, rdf.Namespace(NAMESPACES['sh'])('resultMessage'))

    return {
        focusNode: focusNode,
        message: message
    }


}