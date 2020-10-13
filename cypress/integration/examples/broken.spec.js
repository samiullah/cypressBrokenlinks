let urlMap = {};
let cheerio = require('cheerio');

/**
 * Desc: Checks if a give link is broken or not
 * @param link: The link which is to be checked
 * @returns {Cypress.Chainable<boolean>}: Returns true of false which is chainable
 */
const checkIfLinkIsBroken = (link) => {
    let isBroken = false;
    return cy.request({
        'url': link,
        'failOnStatusCode': false
    }).then((resp) => {
        if (resp.status > 200) {
            isBroken = true;
        }
    }).then(() => {
        return isBroken;
    })

};

/**
 * Desc: Recursively checks status of all of the urls(links) on a page
 * @param pageUrl: The url on which links are to be checked
 */
const checkUrlStatusAcrossWebsite = (pageUrl) => {
    //Finds unique url on the page and then checks if the url is broken or not
    addUniqueUrlsToMap(pageUrl).then(() => {
        for (let prop in urlMap) {
            //Check broken status only when the url is not yet scrapped (checked)
            if (urlMap.hasOwnProperty(prop)) {
                if (urlMap[prop]['isToBeScrapped']) {
                    urlMap[prop]['isToBeScrapped'] = false;
                    checkIfLinkIsBroken(prop).then((isBroken) => {
                        urlMap[prop]['isBroken'] = isBroken;

                        if (isBroken) {
                            cy.task('log', prop + " *** " + urlMap[prop]['parentPage']);
                        }
                    });
                    //recursively iterate over all the urls until all of them are checked
                    checkUrlStatusAcrossWebsite(prop);
                }
            }
        }
    })

};

/**
 * Desc: Adds all the unique url to the hash map
 * @param pageUrl: Page url for which url are to be added to the hashmap
 * @returns {Cypress.Chainable<any>}
 */
const addUniqueUrlsToMap = (pageUrl) => {
    return getAllCypressLinksFromPage(pageUrl).then((urlsArray) => {
        urlsArray.forEach((link) => {
            //add only when urlmap doesn't contain the url
            if (!urlMap.hasOwnProperty(link)) {
                urlMap[link] = {'isToBeScrapped': true, 'parentPage': pageUrl};
            }
        });
    });
};

/**
 * Desc: Get all cypress domain urls from the give page and returns an array
 * @param pageUrl: Page url for which urls are to be extracted
 * @returns {Cypress.Chainable<Array>}
 */
const getAllCypressLinksFromPage = (pageUrl) => {
    let urlsArray = [];
    return cy.request({
        'url': pageUrl,
        'failOnStatusCode': false
    }).then((resp) => {
        //find the urls only when status is 200
        if (resp.status === 200) {
            //load the body using cheerio
            let $ = cheerio.load(resp.body);
            let links = $('a'); //jquery get all hyperlinks

            //iterate over all the links found using a tag
            $(links).each((i, link) => {
                let linkHref = $(link).attr('href');
                if (linkHref !== undefined) {
                    if (linkHref.indexOf('/') === 0) {
                        //converting relative urls to absolute
                        linkHref = Cypress.config().baseUrl + linkHref;
                    }
                    //removing '/' from the last
                    linkHref = linkHref.replace(/\/$/, '');

                    /*pushing the url to array only when:
                    * 1. linkHref starts with Cypress.io
                    * 2. linkHref doesn't contain cdn-cgi (cdn-cgi are some email links which don't point to a page
                    * 3. pageUrl is not equal to linkHref
                    * */
                    if (linkHref.indexOf(Cypress.config().baseUrl) === 0 && linkHref.indexOf('cdn-cgi') === -1
                        && pageUrl.indexOf(linkHref) === -1) {
                        urlsArray.push(linkHref);
                    }
                }
            });
        }
    }).then(() => {
        return urlsArray;
    })
};

context('Find broken urls from "cypress.io"', () => {
    Cypress.on('uncaught:exception', () => {
        return false
    });

    before( () => {
        cy.visit('/');
    });

    it('to recursively check the status of all urls on the website', () => {
        cy.task('log', 'Checking URL status for all urls');
        checkUrlStatusAcrossWebsite(Cypress.config().baseUrl);
    });

    it('to print the broken links', () => {
        cy.task('log', 'Broken Links Are:');
        for (let prop in urlMap) {
            if (urlMap.hasOwnProperty(prop)) {
                if (urlMap[prop]['isBroken']) {
                    cy.task('log', prop);
                }
            }
        }
    });
});