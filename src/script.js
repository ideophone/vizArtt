




////////////////////////
// Der Code macht eine PubMed-Abfrage zu einem bestimmten Suchterm (String) und erhält die Suchtreffer p in Form einer PMID-Liste zurück (ESearch+ESummary).
// Zu p wird eine iCite-Abfrage gemacht, um einerseits an die Gesamtheit aller eine Publikation in p zitierenden Publikationen z zu kommen, und andererseits bibliometrische Daten zu den Publikationen in p zu erhalten.
// Auch zu z wird eine iCite-Abfrage gemacht - um zählen zu können, wie oft die z-Publikationen gezählt werden (durch "z2"), und um bibliometrischen Daten zu den z-Publikationen zu erhalten.
//
//  p: Pubmed-Suchtreffer
//  z: p-Publikationen zitierende Publikationen
//  z2: z-Publikationen zitierende Publikationen
//
////////////////////////


//////Listen für den späteren Gebrauch//////

let pmidList = []; //Array der PMIDs in p

//p-Publikationen und z-Publikationen
let citedby = []; //Array von PMIDs: erster Teil enthält abwechslungsweise eine p-PMID und eine dazugehörige z-PMID (die aber nicht selber auch in p vorkommt), zweiter Teil enthält abwechslungsweise eine z-PMID und eine dazugehörige z2-PMID
let sekList = []; //..entspricht dem citedby-Arrays ohne dessen p-PMIDs - enthält nur dessen z- und z2-PMIDs

//Publikationen als Nodes definiert, und ihre Attribute
let nodes = []; //Array von Objekten mit je zwei named Properties: id: PMID, und group: "0" (sog. Research Article) oder "1" (nicht ein sog. Research Article: könnte Review sein)
let graphnodes = []; //Array von Objekten mit je zwei named Properties: id: PMID, data: Anzahl Referenzen auf diesen Artikel (Zitierungen)
let nodes_attributes = []; //Publikationen-Daten (bibliographische und bibliometrische) von iCite, als Knoten-Attribute: PMID, Titel, Autor, Journal-Name, ob 'primary research article' oder nicht, der RCR-Wert, die NIH-Perzentile und die Zitier-Häufigkeit
let attributes = [];  // Filter-Schlüssel zu nodes_attributes: Liste von Typen von Publikationen-Daten, die vom User ausgewählt wurden ("Filter")

//Zitierungs-Verbindungen (Edges) zwischen Publikationen (Nodes)
let directedlinks = []; //Array von Objekten mit je drei named Properties (Paar von p- oder z-PMIDs 'source' und 'target' (wobei 'source' das 'target' zitiert), sowie 'type'=String: "CITATION"
let edges = []; // ..wie 'directedlinks', aber + 4. named Property 'value': relative citation ratio (RCR) des 'target'
let graphedges = []; // ..wie 'edges', aber + 5.&6. named Properties: 'id': fortlaufende Nr (=jeweiliger Wert von cit_count), data: key-Objekt String "e1"

//Counter-Variablen für Citations und Reviews
let pubArticle_count = 0;
let cit_count = 0; //Counter für die Anzahl von z-p-Zitierungen (nicht gezählt werden p-p-Zitierungen; hingegen: werden mehrere p-Publikationen von der gleichen z-Publikation zitiert, mehrmals gezählt)
let rev_count = 0; //Counter für in p oder z gefundene sog. 'primary research articles' (Definition/Auflistung: vgl. https://icite.od.nih.gov/user_guide?page_id=ug_data#article)
let search_count = 0;
let avg_rcr = 0;

/*
module.exports = search;
module.exports = init;
module.exports = searchPubMed;
module.exports = retrieveDocumentSummary;
module.exports = displayDocumentSummary;
module.exports = getICiteData;
module.exports = getICiteData2;
module.exports = combineData;
module.exports = sliceIntoChunks;
module.exports = createGRAPHML;
*/

/**
 * search
 * @param {string type} query - Searchquery String from inputText or inputFile
 */
async function search(query) {
    try {
        document.getElementById("loader").style.display= "inline";
        init();
        search_count++;
        //// Pubmed-Suchtreffer p (Type: JSON-Objekt)
        let pubMedSearch = await searchPubMed(query);
        let pubMedDocSums = await retrieveDocumentSummary(pubMedSearch);
        //PubMed-Daten in App anzeigen
        displayDocumentSummary(pubMedDocSums);
        //// die die p-Publikationen zitierenden Publikationen z
        // Metadaten zu den PMIDs (JSON-Objekt) der p-Publikationen suchen, inklusive Liste der die p-Publikationen zitierenden Publikaitonen z; sekList und citedby werden befüllt
        let iCiteData = await getICiteData(pubMedDocSums.result.uids);
        console.log("PMID Liste zitierter Artikel:", sekList);
        // Metadaten zu den z-Publikationen suchen, inklusive Liste der die z-Publikaitonen zitierenden Publikationen z2; sekList und citedby werden weiter befüllt
        let iCiteData2 = await getICiteData2(sekList);
        // Zitationsdaten zusammenführen
        let data = combineData(iCiteData, iCiteData2); //##Achtung: funktions-Definition verlangt gar keine Attribute! Macht nichts mit iCiteData und iCiteData2 - sondern macht ein Objekt-Literal 'data' (sic! gleicher Name innerhalb des Scopes der combineData-Funktion wie hier in diesem Scope) mit Property 'nodes' = globale nodes-Variable und Property 'edges' = globale edges-Variable (->bereit für Konversion in JSON, vgl.https://dev.to/kenji_goh/json-vs-javascript-object-literal-omd )
        //let reviews = searchReview(pmidstring); // Suche wird erschwert duch das Einbringen der PMIDs => das , wird als %2C in der URL dargestellt und mögliche Manipulationen zeigen keine Wirkung
        // Ausgabe JSON und direkte Verbindungen (C1 zitiert A1 aus der PMIDliste)
        console.log("JSON created:",data);
        console.log("directed Links: ", directedlinks);
        //Resultat updaten Zitationenhinzufügen
        displayResCount();
        document.getElementById("loader").style.display= "none";
        let x = document.getElementById("divOutput");
        x.style.display ="block";
        //Erstellen des force directed Graphes
        showGraph(data);
        //Daten auf GraphML umformatieren mit den Artikel als Knoten, Zitierungen als Verbuindungen und weiteren Attributen, die aus der Filter Liste ausgewählt werden können
        data = createGRAPHML(nodes, graphedges, attributes, nodes_attributes)
        console.log(data);
        //Export result via Link
        data = saveData();
        return 1;
        //return data;
    } catch(e) {
        console.log(e)
    }
}

//Variablen zurücksetzen
function init(){
    //Counters zurücksetzen
    pub_count = 0;
    rev_count = 0;
    cit_count = 0;
    search_count = 0;
    avg_rcr = 0;
    // Arrays zurücksetzen 
    nodes = [];
    pmidList = [];
    nodes = [];
    graphnodes = [];
    edges = [];
    graphedges = [];
    sekList = [];
    citedby = [];
    directedlinks = [];    
}


/**
 * searchPubMed
 * @param {JSON type} searchString - PubMed ESearch result im JSON-Format
 * @returns {JSON} respond ESearchresult
 */
async function searchPubMed(searchString) {
    // sucht (mittels ESearch) in PubMed nach 'searchString', schreibt das Resultat in die Console und die Suchtreffer-Anzahl in die globale Variable und ins HTML, und gibt das Suchresultat als JSON zurück.
    //nutzt die jQuery ajax get()-Funktion um einen asynchronen HTTP GET Request an den eutils-Server zu machen
    let data = await $.ajax({
        type: 'GET',

        //baut die ESearch-URL zusammen
        url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
        data: {
            db: 'pubmed', //wählt aus den Entrez-Ressourcen die Datenbank PubMed aus
            usehistory: 'y', //"y(es)", so dass das Resultat auf dem 'History'-Server von E-Utilities gespeichert wird, damit es dann von ESummary verwendet werden kann. (Nebenbei liefert so das ESearch-Resultat auch die Information 'count' (=Anzahl Treffer).)
            term: searchString, //Als Such-Term wird das dieser Methode mitgegebene Argument searchString verwendet
            retmode: 'json', //Festlegung des retrieval mode (=Rückgabe-Format) auf JSON (statt Standard XML)
            retmax: 500 //Heraufsetzen der max. Anzahl von PMIDs in der Rückgabe (von Standard 20)
        }
    });
    //gibt das Resultat von ESearch in der Konsole aus
    console.log("searchPubMedData", data);
    //pmidList =  data.esearchresult.idlist;

    //Speichert die Suchtreffer-Anzahl in die entsprechende globale Variable
    pubArticle_count = data.esearchresult.count;
    //schreibt ins HTML, an der Stelle nresultsPubArt, die wievielte Suche/Resultat wieviele Treffer gegeben hat: "x. Resultat: xyz Artikel gefunden:"
    const nres = document.getElementById("nresultsPubArt");
    nres.textContent = pubArticle_count.toString() + " PubMed-Artikel gefunden";
    //gibt das Resultat von ESearch an den Caller der Funktion zurück
    return data;
}

/**
 * retrieveDocumentSummary
 * @param {JSON type} searchResponse - PubMedresultat (Artikel) in JSON-Format
 * @returns {JSON} PubMed Articles (JSON)
 */
async function retrieveDocumentSummary(searchResponse) {
    //Ruft (mittels ESummary) zu jeder PMID in den Suchtreffern das Document Summary ab.
    //nutzt die jQuery ajax get()-Funktion um einen asynchronen HTTP GET Request an den eutils-Server zu machen
    let data = await $.ajax({
        type: 'GET',
        
        //baut die ESummary-URL zusammen
        url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi',
        data: {
            db: 'pubmed', //wählt aus den Entrez-Ressourcen die Datenbank PubMed aus
            usehistory: 'y', //##nötig?
            webenv: searchResponse.esearchresult.webenv, //Statt mit 'id: searchResponse.esearchresult.idlist': die UIDs werden vom History Server geholt
            query_key: searchResponse.esearchresult.querykey, //gehört zu webenv dazu
            retmode: 'json', //Festlegung des retrieval mode (=Rückgabe-Format) auf JSON (statt Standard XML)
            retmax: 500 //Heraufsetzen der max. Anzahl von PMIDs in der Rückgabe (von Standard 20)
        }
    });
    
    //gibt das Resultat von ESummary in der Konsole aus
    console.log("DocumentSummaries", data);

    //gibt das Resultat von ESummary an den Caller der Funktion zurück
    return data;
}


// //ruft (mittels ESummary) zu jeder PMID in den Suchtreffern das Document Summary ab
// async function searchReview(pmids) { 
    
//     //konvertiert die mitgegebene Liste von PMIDs, pmids, in einen " "-getrennten String.
//     let pmidstring = "";
//     for(let i = 0; i < pmids.length; i++){
//         pmidstring = pmidstring + pmids[i] + " "; //das Trennzeichen müsste eigentlich "," sein statt " " - aber in ersterer Fall funktioniert gar nicht, und im letzteren werden statt " " fälschlicherweise "+" einesetzt!..
//     }
//     pmidstring = pmidstring.replace('+', ','); //..das muss hier nachkorrigiert werden: die "+" durch "," ersetzten.

//     //nutzt die jQuery ajax get()-Funktion um einen asynchronen HTTP GET Request an den eutils-Server zu machen
//     let data = await $.ajax({
//         type: 'GET',

//         //baut die ESummary-URL zusammen
//         url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?',
//         data: {
//             db: 'pubmed',//wählt aus den Entrez-Ressourcen die Datenbank PubMed aus
//             usehistory: 'y', //##nötig für ESummary?
//             id: pmidstring, //Komma-getrennte "Liste" von PMIDs, für die die DocSums abgefragt werden soll
//             retmode: 'json', //Festlegung des retrieval mode (=Rückgabe-Format) auf JSON (statt Standard XML)
//             filter: 'pubt.review', //nur die Reviews sollen behalten werden
//             retmax: 1000 //Heraufsetzen der max. Anzahl von PMIDs in der Rückgabe (von Standard 20)
//         }
//     });
    
//     //gibt das Resultat von ESummary in der Konsole aus
//     console.log("searchReviews", data);

//     //gibt das Resultat von ESummary an den Caller der Funktion zurück
//     return data;
// }


/**
 * Zeigt die interessierenden Inhalte der Document Summaries im HTML an und befüllt die globale pmidList mit den PMIDs.
 *
 * @alias displayDocumentSummary~pubMedData
 * @param {JSON type} PubMedData - PubMedresultat in JSON-Format
 */
function displayDocumentSummary(pubMedData) {

    let output = $('#output'); //weist der variable 'output' das HTML-Element mit id="output" zu.

    $.each(pubMedData.result, function (i, article) { //JQuery.each(array/object,callback) iteriert über die das array/object (hier: pubmedData.result) und wendet pro Element das callback (hier: 'function (i,..') an
        
        //fügt der globalen pmidList die article.uid des jetzigen pubMedData.result (=der jetzigen Publikation) hinzu
        pmidList.push(article.uid);
        pub_count++;
        
        //fügt dem HTML-Element output ein Listen-Element hinzu, das 'item' genannt wird, und diesem wiederum ein div-Element 'container'. Befüllt diese folgenden Daten der jetzigen Publikation: Publikationsdatum und Journalname resp. PMID, Titel und Link auf PubMed
        let item = $('<li/>').appendTo(output); 
        let container = $('<div/>').appendTo(item);
        //Publikationsdatum und Journalname
        $('<p/>', {
            text: article.pubdate + " | " +  article.fulljournalname
        }).appendTo(item);
        //PMID +Titel + Link zum Artikel
        $('<a/>', {
            href: "https://pubmed.ncbi.nlm.nih.gov/" +article.uid,
            text: article.uid + " | " + article.title,
        }).appendTo(container);
        ////Konvertiert den Namen jedes Autors (JS-Objekt) der jetzigen Publikation in einen JSON-String, und konketeniert fortlaufend zu einem einzigen JSON-String für die jetzige Publikation
        $('<p/>', {
            text: JSON.stringify(article.authors) //macht ein HTML-Element 'text', das die in einen JSON-String konvertierte Autorenliste (JS-Objekt?) der jetzigen Publikation enthält
        }).appendTo(item); //fügt das text-Element dem 'item'-Element hinzu
        //Trennlinie nach jeder Publikation
        $('<hr width="98%" align="center" height="25px" background-color="blue">').appendTo(item);
    });

    //gibt die globale pmidList in der Konsole aus
    console.log("IdList", pmidList);
    document.getElementById("pubart").innerHTML = "PubMed Artikel gefunden: " + pub_count;
}

/**
 * getICiteData~pmidList
 * @param {list type} pmidList - List of PubMed IDs (primary search result) 
 * @returns {JSON type} data - iCite respond (further information to the existing articles)
 */
async function getICiteData(pmidList) {
    // für das die PMID-Liste (JSON-Objekt; p- oder z-Publikationen) pmidList wird eine iCite-Anfrage gemacht um jede PMID (bzw. die dazugehörigen Metadaten) korrekt in die Listen nodes, graphnodes und nodes_attributes einzutragen; der rev_count wird ggf. erhöht.
    //(=pmidList)
    //Für den Suchterm 'query'=pmidList wird die jQuery ajax get()-Funktion genutzt um einen asynchronen HTTP GET Request an den icite-Server gemacht
    let query = pmidList.toString();
    let data = await $.ajax({
            method : "GET",
            url: "https://icite.od.nih.gov/api/pubs?pmids=" + query,
            
    })
    //gibt alle PMIDs (genannt 'article'), für die die iCite-Abfrage gemacht wurden (=pmidList), in der Konsole aus, und loopt durch sie hindurch
    console.log("getICiteData", data.data);
    data.data.forEach(article => {
        //console.log(article);
        //Die jetzige PMID wird den 'nodes' hinzugefügt mit Property 'id'=PMID und..
        //..wenn die PMID für einen sog. 'primary research article' steht (Definition/Auflistung: vgl. https://icite.od.nih.gov/user_guide?page_id=ug_data#article) mit Property 'group'=0, ..
        if(article.is_research_article == "Yes"){
            nodes.push({id : article.pmid,group: "0"});
        }
        //..wenn die PMID nicht für einen sog. 'primary research article' könnte es sich dabei um ein Review handeln: das Property 'group' ist 1 (dient dem farblich Hervorheben im Graphen) und der revCount wird hochgezählt und die PMID in der Konsole ausgegeben..
        else {
            console.log("Possible review found: ", article.pmid); 
            rev_count++;
            nodes.push({id : article.pmid,group: "1"}); //Gruppe "1" wird im Graphen orange hervorgehoben
        }
        //..und in beiden Fällen wird auch den 'graphnodes' die PMID als 'id' hinzugefügt, plus ein Objekt 'data'='key':"n1"..
        graphnodes.push({id : article.pmid , data: article.cited_by.length});
        //..und den 'nodes_attributes' weitere Daten als Attribute (Aufzählung: vgl. hier oder in Variablen-Definition)
        nodes_attributes.push({pmid : article.pmid, authors: article.authors, journal: article.journal, is_res_article: article.is_research_article, rcr: article.relative_citation_ratio, nih: article.nih_percentile, cit_count: article.citation_count, animal: article.animal, expcit: article.expected_citations_per_year, fieldcit: article.field_citation_rate, citedbyclin: article.cited_by_clin, citedby: article.cited_by, refs: article.references});
        avg_rcr += article.relative_citation_ratio;
        //nun werden auch noch die die Publikationen in pmidList (p- oder z-Publikaitonen) zitierenden (z- bzw. z2-)Publikationen untersucht.
        //sofern die Liste der z-p- bzw. z2-z-Zitierungen nicht leer ist, wird durch sie durchgeloopt, und jede z- bzw. z2-Publikation wird untersucht
        if(article.cited_by.length != 0) {
            for(j = 0; j < article.cited_by.length; j++ ){
                cit_count++; //zählt den globalen Counter für z-p- und z2-z-Zitierungen hoch

                //Sofern diese z- bzw. z2-Publikation keine unbekannte/"undefined" PMID hat, wird sie näher untersucht
                if(article.cited_by[j] != undefined){
                    //falls die PMID dieser z- bzw. z2-Publikation bereits in p bzw. z drin ist (=in pmidList), handelt es sich um eine p-p- bzw. z-z-Zitierung und die Verbindungen werden in die Arrays directeslinks, edges und graphedges aufgenommen...
                    if(pmidList.includes(article.cited_by[j].toString())){
                        console.log("Direkt Link found: Eine p-Publikation zitiert eine andere p-Publikation, oder eine z- zitiert eine z-Publikation")
                        
                        //für die Erläuterung dieser drei Arrays: vgl. Kommentare bei deren Instanzierung am Code-Anfang
                        directedlinks.push({source : article.cited_by[j], target : article.pmid, type: "CITATION"});
                        edges.push({target: article.pmid, source: article.cited_by[j], value: article.relative_citation_ratio,  type: "CITATION"});
                        graphedges.push({id: cit_count, target: article.pmid, source: article.cited_by[j], value: article.relative_citation_ratio,  type: "CITATION", data: {key: "e1"}});
                    }
                    //..andernfalls werden sie in die Arrays citedby und sekList aufgenommen
                    else{
                        //nodes.push({id :  article.cited_by[i], group: "5"}); //Diese Zeile entkommentieren, falls sämtliche z- und z2-Publikationen ebenfalls im GraphML erscheinen sollen
                        citedby.push(article.pmid, article.cited_by[j]); //z-p-Zitierung kommt in die entsprechende globale Liste
                        sekList.push(article.cited_by[j]);  //z-Publikation kommt in die entsprechende globale Liste
                    }                       
                }            
            }
        }
    });
    avg_rcr = avg_rcr / data.data.length;

    console.log("Reviews found: ", rev_count);
    console.log("Cited_by", citedby);
    console.log("Nodes created:", nodes);
    console.log("Nodes attributes: ", nodes_attributes);
    console.log("Edges created:", edges);
    return data;
}

/**
 * getICiteData2
 * @param {list type} idlist - List of IDs (cited_by articles form primary search result)
 * @returns {JSON type} data - iCite respond (further information to the existing articles cited by the primary search) 
 */
async function getICiteData2(idlist) {
    //2. Suche auf iCite mit den zitierenden Artikel aus der ersten Suche. macht eine iCite-Abfrage zu den PMIDs im Array idlist; 1000 Pakete 
    let data;
    console.log("List of PMIDs; ", idlist)
    let maxLength = 1000;
    if(idlist.length > maxLength){
        let subquery = sliceIntoChunks(idlist, maxLength);
        console.log(subquery);
        for(let i = 0; i < Math.ceil(subquery.length / maxLength); i++){
            data = await getICiteData(subquery[i]);
            console.log(data);
        }
    }
    else{
        data = await getICiteData(idlist);
    }
    return data;
}

/**
 * sliceIntoChunks
 * @param {Array type} arr - die Tabelle mit den zu verkleinernden Daten 
 * @param {int type} chunkSize - Päckchen Grösse
 * @returns {Array type} res - Array of each chunk
 */
function sliceIntoChunks(arr, chunkSize) {
    // teilt ein Array arr in Stücke der Grösse chunkSize auf und gibt sie in ein gemeinsames übergeordnetes Array verpackt zurück. (z.B.: arr hat Länge 100, chunkSize=20 -> return-Wert ist ein Array, das 5 20er-Arrays enthält).
    const res = [];
    const fullChunks = Math.floor(arr.length / chunkSize);
    for(let i = 0; i  < fullChunks; i++){
        const chunk = arr.slice(i*chunkSize, (i + 1)*chunkSize);
        console.log("chunk",i+1+":", chunk);
        res.push(chunk);
    }
    if (arr.length % chunkSize >0){
        let lastChunk = arr.slice(fullChunks*chunkSize,arr.length)
        console.log("chunk",fullChunks+1+":", lastChunk);
        res.push(lastChunk)
    }
    return res;
}

/**
 * displayResCount
 * Gesamtmenge an Artikel, Zitationen und Reviews anzeigen. Zusätzlich interpretation der Werte  
 */
function displayResCount(){
    const nreszit = document.getElementById("nresultsZit");
    nreszit.textContent = "Zitationen: " + cit_count  + " | directed Links: " + directedlinks.length + "\n";
    const nresRev = document.getElementById("nresultsRev");
    nresRev.textContent = " Reviews: " + rev_count  + "\n";
    //Interpretation einfügen 
    const interpret = document.getElementById("interpretation");
    // Wenn die Anzahl der direkten Zitierungen im Verhältnis zur gesamten Anzahl Zitierungen (0.4) beträgt + Wenn mindestens 4 Cluster gebildet werden können + AVG rCr = 1.5 beträgt
    // Muss zwingend zu einem Teil mit Lit. nachgewisen werden können
    if(directedlinks / cit_count >= 0.2 && avg_rcr > 1 && cit_count / rev_count > 1 && pubArticle_count / directedlinks > 1){
        interpret.textContent = "Gut erforscht"; 
    }   
    else{
        interpret.textContent = "In diesem Gebiet lohnt es sich eine weitere Analyse vorzunehmen. (Resultat exportieren)";
    }
}

/**
 * combineData
 * Create a dataobject for the found nodes and edges to create a graph
 * @returns {object type} data - object combined of nodes and edges
 */
function combineData(){
    const data = {
        nodes: nodes,
        edges: edges
    }
    return data
}

 //Schaut im HTML nach, welche Attribut-Typen ausgewählt sind, schreibt sie in die globale Variable (Array) 'attributes' und gibt sie auch als Return-Wert zurück
 function setAttributes(){
    var selected = [];
    $('.filters__list input:checked').each(function() {
        selected.push($(this).val());
    });
    console.log(selected);
    attributes = selected;
    saveData();
    return selected;
}

function resetAttributes(){
    $('input[type=checkbox]').prop('checked',false);
}

/**
* createGRAPHML
* @param {object type} nodes - Knoten (Artikel) 
* @param {object type} edges - Kanten (Zitation) 
* @param {object type} attributes - Attributen als Schlüssel 
* @param {object type} nodes_attributes - Zusatzinformationen zu den Artikel 
* @returns {string type} output string - graphML Syntax 
*/
function createGRAPHML(nodes, edges, attributes, nodes_attributes){
    let keystring = "";
    let nodestring ="";
    let edgestring = "";
    let attributesTypes = ["int", "string", "string", "string", "double", "int", "int", "double", "double", "string", "string"]
    for(let i = 0; i < 13; i++){
        keystring += '<key id="'+ attributes[i] +'" for="edge" attr.name="'+ attributes[i] +'" attr.type="'+ attributesTypes[i] +'">\n'
        
    }
    for(let i = 0; i < nodes.length; i++){
        nodestring += '<node id="'+ nodes[i].id+'">\n' +
         '<data key="n1">'+ nodes[i].group +'</data>\n';
         
        for(let j = 0; j < attributes.length; j++){
            let _attributes = attributes.at(j);
            switch(_attributes){
                case "PMID": 
                    nodestring += '<data key="'+ attributes[j] + '">' + nodes_attributes[i].pmid + '</data>' + "\n";
                    break;
                case "Authors": 
                    nodestring += '<data key="'+ attributes[j]  + '">' + nodes_attributes[i].authors + '</data>' + "\n";
                    break;
                case "Journal": 
                    nodestring += '<data key="'+ attributes[j]  + '">' + nodes_attributes[i].journal + '</data>' + "\n";
                    break;
                case "is_research_article": 
                    nodestring += '<data key="'+ attributes[j]  + '">' + nodes_attributes[i].is_res_article + '</data>' + "\n";
                    break;
                    case "relative_citation_ratio": 
                    nodestring += '<data key="'+ attributes[j]  + '">' + nodes_attributes[i].rcr + '</data>' + "\n";
                    break;
                case "nih_percentile": 
                    nodestring += '<data key="'+ attributes[j]  + '">' + nodes_attributes[i].nih + '</data>' + "\n";
                    break;
                case "animal": 
                    nodestring += '<data key="'+ attributes[j]  + '">' + nodes_attributes[i].animal + '</data>' + "\n";
                    break;
                case "citation_count": 
                    nodestring += '<data key="'+ attributes[j]  + '">' + nodes_attributes[i].cit_count + '</data>' + "\n";
                    break;
                    case "expected_citation_per_year": 
                    nodestring += '<data key="'+ attributes[j]  + '">' + nodes_attributes[i].expcit + '</data>' + "\n";
                    break;
                case "field_citation_rate": 
                    nodestring += '<data key="'+ attributes[j]  + '">' + nodes_attributes[i].fieldcit + '</data>' + "\n";
                    break;
                case "cited_by_clin": 
                    nodestring += '<data key="'+ attributes[j]  + '">' + nodes_attributes[i].citedbyclin + '</data>' + "\n";
                    break;
                case "cited_by": 
                    nodestring += '<data key="'+ attributes[j]  + '">' + nodes_attributes[i].citedby + '</data>' + "\n";
                    break;
                case "references": 
                    nodestring += '<data key="'+ attributes[j]  + '">' + nodes_attributes[i].refs + '</data>' + "\n";
                    break;
             }
        }
        nodestring += '</node>\n'
    }
    
    for(let i = 0; i < edges.length; i++){
        edgestring += '<edge source="'+edges[i].source+'"'+ ' target="' + edges[i].target+'">\n' +
        '<data key="e1">'+ Math.round(edges[i].value) +'</data>\n'+
        '</edge>\n'
    }
    
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns"\n' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
    'xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns\n' +
    'http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">\n' +
    '<key id="e1" for="edge" attr.name="cites" attr.type="double">\n'+
    keystring +'<default>1</default></key>\n' +
    '<key id="n1" for="node" attr.name="Article-Type" attr.type="int">\n' +
    '<default>1</default></key>\n' +
    '<graph edgedefault="undirected">\n' + 
    nodestring + "\n" + "\n" + edgestring + '\n' + 
    '</graph></graphml>';
}

/**
 * save
 * Exportieren des Ergebnis in graphML Format
 * @param {string type} xml - String in XML Syntax 
 * @returns {object type} graphML String
 */
function save(xml){
    let gephiXML = new gephiXML([xml], {type: "text/xml"});
    saveAs(gephiXML, "graph.graphml");
}

function saveData(){
    let  data = createGRAPHML(nodes, graphedges, attributes, nodes_attributes)
    console.log(data);

    const a1 = document.getElementById("a1");
        const file = new Blob([data], {type: "text/plain"})
        a1.href = URL.createObjectURL(file);
}

function showGraph(data) {    
    //Falls vorhanden Graph löschen
    d3.select("svg").remove();
    var svg = d3.select("#dataviz_basicZoom"),
    width = +svg.attr("width"),
    height = +svg.attr("height");

    var svg = d3.select("#dataviz_basicZoom")
    .append("svg")
        //
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", "0 0 960 480")
        /*
        .attr("width",  900)
        .attr("height",  700)
        */
        .call(d3.zoom().on("zoom", function () {
        svg.attr("transform", d3.event.transform)
        }))
    .append("g")

    var color = d3.scaleOrdinal(d3.schemeCategory10);

    var simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(function(d) { return d.id; }))
        .force("charge", d3.forceManyBody())
        .force("center", d3.forceCenter(width / 2, height / 2));
    
    d3.set(data)

    var link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(data.edges)
        .enter().append("line")
        .attr("stroke-width", function(d) { return Math.sqrt(d.value); });

    var node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(data.nodes)
        .enter().append("g")

    var circles = node.append("circle")
        .attr("r", 6)
        .style("fill", function(d) { return color(d.group); });

    // Create a drag handler and append it to the node object instead
    var drag_handler = d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);

    drag_handler(node);
    
    var lables = node.append("text")
        .text(function(d) {
            return d.id;
        })
        .attr('x', 6)
        .attr('y', 3);

    node.append("title")
        .text(function(d) { return d.id; });

    simulation
        .nodes(data.nodes)
        .on("tick", ticked);

    simulation.force("link")
        .links(data.edges);

    function ticked() {
        link
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });
    
        node
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            })
        }

    function dragstarted(d) {
        if (!d3.event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }
    
    function dragended(d) {
        if (!d3.event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}



    




