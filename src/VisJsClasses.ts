import * as rdf from 'rdflib'

import { NAMESPACES } from './Namespaces'
import { NamedNode, Term } from 'rdflib/lib/tf-types';

export function shortenURI(uri: string): string {
    // if (uri) {
        for (const [prefix, baseUri] of Object.entries(NAMESPACES)) {
            if (uri.startsWith(baseUri)) {
                return `${prefix}:${uri.slice(baseUri.length)}`;
            }
            // else {
                // return uri
            // }
        }
        return uri
        // return uri; // Return original if no match
    // }
}

function normalizeString(str: string): string {
    return str.replace(/\s+/g, ' ').trim()
}

function getObject(subject: Term, rdfGraph: rdf.Store, predicateUri: NamedNode) {
    // TODO: this type casting is ugly
    const matches = rdfGraph.match(subject as NamedNode | rdf.BlankNode | rdf.Variable, predicateUri, null); // Match subject and predicate

    // debugger
    return matches.map(x => x.object)
    // return matches.length > 0 ? matches[0].object : undefined; // Ret
}

export function getStringObject(subject: Term, rdfGraph: rdf.Store, predicateUri: NamedNode) {
    const objects = getObject(subject, rdfGraph, predicateUri)
    return objects.map(x => normalizeString(x.value))
    // const matches = rdfGraph.match(subject as NamedNode | rdf.BlankNode | rdf.Variable, predicateUri, null); // Match subject and predicate
    // return object ? normalizeString(object.value) : undefined; // Ret
}

function getUri(term: Term) {
    return (term.termType === 'NamedNode') ? shortenURI(term.value) : `_:${term.value}`
}



export class VisNode {

    public readonly id: string
    public readonly label: string | undefined
    public readonly type: string | undefined
    public readonly title: string | undefined
    public readonly fixed: boolean
    public readonly group: string

    // public readonly shape: string = "box"
    public readonly borderWidth: number = 2
    public shapeProperties: object = {
        borderDashes: false
    }

    public readonly font: object = {
        multi: 'md',
        // size: 20
        face: 'georgia'
    }

    // public readonly arrow: string = 'to'

    private splitTextIntoLines(text: string, lineLength: number) {
        if (lineLength <= 0) throw new Error("Line length must be greater than 0");

        let lines = [];
        let currentLine = "";

        const words = text.split(" ");

        for (let word of words) {
            // If adding the word exceeds the line length, push the current line and reset
            if (currentLine.length + word.length + 1 > lineLength) {
                // If the word itself is too long, split it with a dash
                if (word.length > lineLength) {
                    while (word.length > lineLength) {
                        lines.push(word.slice(0, lineLength - 1) + "-");
                        word = word.slice(lineLength - 1);
                    }
                }
                lines.push(currentLine);  // Push the current line
                currentLine = word;       // Start a new line with the current word
            } else {
                currentLine += (currentLine ? " " : "") + word;  // Add word to the current line
            }
        }

        // Add any remaining content in the current line
        if (currentLine) {
            lines.push(currentLine);
        }

        return lines.join("\n");
    }

    private getNodeGroup(rdfTypes: string[]): string {

        
        if (rdfTypes.length == 0)
            return ''
        
        const riskman = rdf.Namespace(NAMESPACES['riskman'])
        
        if ([riskman('RiskLevel').value, riskman('Severity').value, riskman('Probability').value].some(t => rdfTypes.includes(t))) {
            return 'rl'
        } else if ([riskman('AnalyzedRisk').value, riskman('Harm').value, riskman('DeviceContext').value, riskman('DeviceContext').value, riskman('HazardousSituation').value, riskman('HazardousSituation').value, riskman('Event').value].some(t => rdfTypes.includes(t))) {
            return 'ar'
        } else if ([riskman('DomainSpecificHazard').value, riskman('DeviceFunction').value, riskman('DeviceComponent').value, riskman('Hazard').value, riskman('DeviceProblem').value].some(t => rdfTypes.includes(t))) {
            return 'dsh' 
        } else if ([riskman('SDA').value, riskman('SDAI').value].some(t => rdfTypes.includes(t))) {
            return 'sda' 
        } else if (rdfTypes.includes(riskman('ImplementationManifest').value)) {
            return 'im'
        } else if (rdfTypes.includes(riskman('SafetyAssurance').value)) {
            return 'sa'
        } else if (rdfTypes.includes(riskman('ControlledRisk').value)) {
            return 'cr'
        }

        return ''
    }


    private constructLabel(rdfsLabel: string | undefined, nodeUri: string | undefined, type: string[]) {

        const typesFormatted = type?.length
        ? type.map(t => `*${t}*`).join('\n')
        : '';

        return `
         ${typesFormatted}
         \`(${nodeUri ?? ""})\`
         _${rdfsLabel ?? ""}_
        `
    }

    public static CreateInferred(node: Term, rdfGraph: rdf.Store) {
        const inferred = new VisNode(node, rdfGraph)
        inferred.shapeProperties = {
            borderDashes: [1,5]
        } 
        return inferred
    }

    public constructor(node: Term, rdfGraph: rdf.Store) {

        const id = node.value
        const nodeUri = getUri(node)


        const types = getStringObject(node, rdfGraph, rdf.Namespace(NAMESPACES['rdf'])('type'))


        // const rdfType = shortenURI(type)
        const rdfType = types.map(x => shortenURI(x))
        
        const rdfsLabelTmp = getStringObject(node, rdfGraph, rdf.Namespace(NAMESPACES['rdfs'])('label'))
        const rdfsLabel = (rdfsLabelTmp.length > 0) ? rdfsLabelTmp[0] : undefined

        this.id = id
        this.label = this.constructLabel(rdfsLabel, nodeUri, rdfType)
        this.title = rdfsLabel // temporary

        this.group = this.getNodeGroup(types)

        let controlledRisk = rdf.Namespace(NAMESPACES['riskman'])('ControlledRisk')
        this.fixed = (types.includes(controlledRisk.value))

    }


}

export class VisEdge {

    public readonly code: string
    public readonly from: string
    public readonly to: string
    public readonly label: string | undefined
    public readonly title: string | undefined

    public dashes: boolean = false

    public readonly font: object = {
        background: "white"
    }


    public readonly arrows: object = {
        to: {
            enabled: true,
            type: 'arrow'
        }
    }
    // public readonly dashed: boolean 

    public static CreateInferred(node: rdf.Statement, rdfGraph: rdf.Store) {
        const inferred = new VisEdge(node, rdfGraph)
        inferred.dashes = true
    }

    public constructor(triple: rdf.Statement, rdfGraph: rdf.Store) {

        this.code = triple.predicate.value
        this.from = triple.subject.value
        this.to = triple.object.value
        this.label = shortenURI(triple.predicate.value)
        this.title = shortenURI(triple.predicate.value)
    }

}

export class VisGraph {
    public readonly nodes: VisNode[]
    public readonly edges: VisEdge[]

    public constructor(nodes: VisNode[], edges: VisEdge[]) {
        this.nodes = nodes
        this.edges = edges
    }

}