import * as vscode from 'vscode'
import { VisGraph } from './VisJsClasses'
import * as rdf from 'rdflib'

export class GraphPanel {

    public static currentPanel: GraphPanel | undefined

    public static readonly viewType = 'graphPanel'
    public static readonly title = 'Graph' 

    private readonly _panel: vscode.WebviewPanel
    private readonly _extensionUri: vscode.Uri

    private _graph: VisGraph
    private _graphDelta: VisGraph | undefined

    public static message(message: any) {
        if (!GraphPanel.currentPanel)
            return

        GraphPanel.currentPanel._panel.webview.postMessage(message)
    }

    public static createOrShow(extensionUri: vscode.Uri, graph: VisGraph) {
        // get column
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined

        // If panel already exists, show it
        if (GraphPanel.currentPanel) {
            GraphPanel.currentPanel._panel.reveal(column)
            return
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            GraphPanel.viewType,
            GraphPanel.title,
            column || vscode.ViewColumn.One,
            GraphPanel.getWebViewOptions()

        )

        GraphPanel.currentPanel = new GraphPanel(panel, extensionUri, graph)
    }

    private static getWebViewOptions(): vscode.WebviewOptions {
        return {
            enableScripts: true,

        }
    }


    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, graph: VisGraph, graphDelta: VisGraph | undefined = undefined) {
        this._panel = panel
        this._extensionUri = extensionUri

        this._graph = graph
        this._graphDelta = graphDelta

        this._update()

        //
    }

    // private methods
    private _update() {
        const webview = this._panel.webview
        this._panel.webview.html = this._getHtmlForWebView(webview)
    }

    private _getHtmlForWebView(webview: vscode.Webview): string {


        const visjsPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'vis-network', 'standalone', 'umd', 'vis-network.min.js')
        const scriptUri = webview.asWebviewUri(visjsPathOnDisk)

        const stylePathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'graphPanelMedia', 'style.css')
        const styleCss = webview.asWebviewUri(stylePathOnDisk)

        let code = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <title>Network</title>
                <script type="text/javascript" src="${scriptUri}"></script>
                <style type="text/css">
                /*#mynetwork {
                    width: 600px;
                    height: 400px;
                    border: 1px solid lightgray;
                }*/
                </style>
                <link href="${styleCss}" rel="stylesheet">
            </head>
            <body>
                <div id="mynetwork"></div>
                <script type="text/javascript">
                // create an array with nodes
                var nodes = new vis.DataSet(
                    ${JSON.stringify(this._graph.nodes)}
                );

                // create an array with edges
                var edges = new vis.DataSet(
                    ${JSON.stringify(this._graph.edges)}
                );

                // create a network
                var container = document.getElementById("mynetwork");
                var data = {
                    nodes: nodes,
                    edges: edges,
                };
                var options = {
                    layout: {
                        // hierarchical: {
                            // direction: "DU",
                            // sortMethod: "directed",
                        // },
                    },   
                    nodes: {
                        shape: "box",
                        margin: 10,
                        widthConstraint: {
                            maximum: 200,
                        },
                    }, 
                    edges: {
                        color: { color: 'white', highlight: 'black' },
                        background: {
                            enabled: true,
                            color: "black",
                            size: 1,
                            // dashes: [20, 10],
                        },
                        arrows: {
                            to: {
                                enabled: true,
                                type: 'arrow'
                            }               
                        }
                    },
                    groups: {
                        rl: {
                            color: { background: "#E3F2FD", border: "#1976D2" },                        
                        },
                        ar: {
                            color: { background: "#B2EBF2", border: "#00BCD4" },                        
                        },
                        dsh: {
                            // color: { background: "#FCE4EC", border: "#D81B60" }, // magenta
                            color: { background: "#F3E5F5", border: "#8E24AA" }, // magenta
                        },
                        sda: {
                            color: { background: "#FFF9C4", border: "#FBC02D" }, // yellow
                        },
                        sa: {
                            color: { background: "#C5CAE9", border: "#3F51B5" },                        
                        },
                        cr: {
                            color: { background: "#FFF3E0", border: "#F57C00" },                        
                        },
                        im: {
                            color: { background: "#E8F5E9", border: "#388E3C" },                        
                        }
                    },
                    physics: { 
                        enabled: true, 
                        // hierarchicalRepulsion: {
                            // avoidOverlap: 1
                        // },
                        wind: { x: 1, y: 0 },
                        barnesHut: {
                            gravitationalConstant: -20000,
                            springLength: 95,
                            springConstant: 0.04
                        },
                        // minDistance: 100,  // Minimum distance between nodes
                    }  

                };
                var network = new vis.Network(container, data, options);


                function zoom(nodeId) {

                    network.focus(nodeId, {
                        scale: 10,
                        animation: {
                            duration: 3000,
                            easingFunction: 'easeInOutQuad'
                        }
                    })
                }



                // Handle the message
                window.addEventListener('message', event => {
                    let eventData = event.data.data
                    console.log(eventData)
                    if (event.data.type === 'infer') {
                        eventData.nodes.forEach(node =>
                            nodes.add(node)
                        )
                        eventData.edges.forEach(edge =>
                            edges.add(edge)
                        )
                    } else if (event.data.type === 'validate') {
                        eventData.forEach(res => {
                            nodes.update({
                                id: res.focusNode,
                                title: res.message,
                                color: { background: 'red', border: 'white' },   
                                font: { color: 'white' }
                        })
                        // if(eventData.length > 0) {
                            // zoom(eventData[0].focusNode)
                        // }
                    })
                     
                    }
                    //console.log(event.data.data)

                    // console.log('http://foo.com/controlledRisk1')
                    //console.log(event.data.nodeId)

                    // debugger
                    // updateNodeAndZoom('http://foo.com/controlledRisk1', 'red')

                    //updateNodeAndZoom(event.data.nodeId, event.data.newColor)
                })

                </script>
            </body>
            </html>`

        // const uint8Array = Buffer.from(code, 'utf8');
        // const fileUri = vscode.Uri.file('testfile.html');
        // vscode.workspace.fs.writeFile(fileUri, uint8Array)
        return code

    }

}