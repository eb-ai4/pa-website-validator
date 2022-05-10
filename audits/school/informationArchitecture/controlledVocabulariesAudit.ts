'use strict'

import { CheerioAPI } from "cheerio"
import crawlerTypes from "../../../types/crawler-types"
import vocabularyResult = crawlerTypes.vocabularyResult

// @ts-ignore
const Audit = require('lighthouse').Audit

// @ts-ignore
import got from "got"

// @ts-ignore
import * as cheerio from "cheerio"

// @ts-ignore
const storageFolder = __dirname + '/../../../storage/school'

// @ts-ignore
const vocabularyFile = 'controlledVocabulary.json'

// @ts-ignore
const vocabularies = require(storageFolder + '/' + vocabularyFile)

// @ts-ignore
class LoadAudit extends Audit {
    static get meta() {
        return {
            id: 'school-controlled-vocabularies',
            title: 'I vocaboli appartengono al vocabolario scuole',
            failureTitle: 'Più del 50% dei vocaboli non appartiene ad EuroVOC o al Modello Scuole',
            scoreDisplayMode: Audit.SCORING_MODES.NUMERIC,
            description: 'Test per verificare la presenza dei vocaboli sotto ARGOMENTI nei vocabolari scuole ed EuroVOC - Verde se tutti gli argomenti appartengono al vocabolario scuole. Modello scuole: https://docs.google.com/spreadsheets/d/1MoayTY05SE4ixtgBsfsdngdrFJf_Z2KNvDkMF3tKfc8/edit#gid=2135815526',
            requiredArtifacts: ['controlledVocabularies']
        }
    }

    static async audit(artifacts: any) : Promise<{ score: number, details: LH.Audit.Details.Table }> {
        const url = artifacts.controlledVocabularies

        const headings = [
            { key: 'all_arguments_in_school_model', itemType: 'text', text: 'Tutti gli elementi sotto ARGOMENTI sono nel vocabolario scuole' },
            { key: 'all_arguments_in_eurovoc_model', itemType: 'text', text: 'Tutti gli elementi sotto ARGOMENTI sono nel vocabolario EuroVOC' },
            { key: 'eurovoc_element_percentage', itemType: 'text', text: '% elementi mancanti in vocabolario eurovoc' },
            { key: 'scuole_element_percentage', itemType: 'text', text: '% elementi mancanti in vocabolario scuole' },
            { key: 'element_not_in_school_model', itemType: 'text', text: 'Elementi non presenti nel modello scuole' },
            { key: 'element_not_in_eurovoc_model', itemType: 'text', text: 'Elementi non presenti nel modello EuroVOC' }
        ]

        const queryUrl = '/?s'
        const searchUrl = url + queryUrl

        const response = await got(searchUrl)
	    const $ = cheerio.load(response.body)

        const argumentsElements = getArgumentsElements($)
        const schoolModelCheck = areAllElementsInVocabulary(argumentsElements, vocabularies.schoolModelVocabulary)
        const eurovocModelCheck = areAllElementsInVocabulary(argumentsElements, vocabularies.eurovocVocabulary)


        let numberOfElementsNotInEurovocModelPercentage: any = 100
        let numberOfElementsNotInScuoleModelPercentage: any = 100

        if (argumentsElements.length > 0) {
            numberOfElementsNotInEurovocModelPercentage = (( eurovocModelCheck.elementNotIncluded.length / argumentsElements.length) * 100).toFixed(0)
            numberOfElementsNotInScuoleModelPercentage = (( schoolModelCheck.elementNotIncluded.length / argumentsElements.length) * 100).toFixed(0)
        }

        let score = 0
        if (schoolModelCheck.allArgumentsInVocabulary) {
            score = 1
        } else if ( schoolModelCheck.allArgumentsInVocabulary ||
                    eurovocModelCheck.allArgumentsInVocabulary ||
                    numberOfElementsNotInEurovocModelPercentage < 50 ||
                    numberOfElementsNotInScuoleModelPercentage < 50
        ) {
            score = 0.5
        }

        const items = [
            {
                all_arguments_in_school_model: schoolModelCheck.allArgumentsInVocabulary ? 'Sì' : 'No',
                all_arguments_in_eurovoc_model: eurovocModelCheck.allArgumentsInVocabulary ? 'Sì' : 'No',
                eurovoc_element_percentage: numberOfElementsNotInEurovocModelPercentage + '%',
                scuole_element_percentage: numberOfElementsNotInScuoleModelPercentage + '%',
                element_not_in_school_model: schoolModelCheck.elementNotIncluded.join(', '),
                element_not_in_eurovoc_model: eurovocModelCheck.elementNotIncluded.join(', '),
            }
        ]

        return {
            score: score,
            details: Audit.makeTableDetails(headings, items)
        }
    }
}

module.exports = LoadAudit

function getArgumentsElements($: CheerioAPI) : string[] {
    const searchResultFilters = $('.custom-control-label')

    let argumentElements = []
    for (let element of searchResultFilters) {
        argumentElements.push($(element).text().trim())
    }

    return argumentElements
}

function areAllElementsInVocabulary(pageArguments: string [], vocabularyElements: string []) : vocabularyResult {
    let result = true

    if (pageArguments.length <= 0) {
        result = false
    }

    let elementNotIncluded = []
    for (let pageArgument of pageArguments) {
        if(!vocabularyElements.includes(pageArgument)) {
            result = false
            elementNotIncluded.push(pageArgument)
        }
    }

    return {
        allArgumentsInVocabulary: result,
        elementNotIncluded: elementNotIncluded
    }
}