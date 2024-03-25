class ApiError extends Error {
    constructor(statusCode, statusMessage, ...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }

        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.statusMessage = statusMessage;
    }
}

function handleErrors(response) {
    if (response.status < 400) {
        return response;
    }
    throw new ApiError(
        response.status,
        response.statusText,
        response.statusText);
}

function toJson(response) {
    return response.json();
}

function toData(json) {
    return json.data;
}

function getJson(url) {
    return fetch(
        url,
        {
            mode: 'cors'
        })
        .then(handleErrors)
        .then(toJson)
        .then(toData);
}

function postJson(url, data) {
    const headers = {
        'Content-Type': 'application/json'
    };

    return fetch(
        url,
        {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers,
            body: data ? JSON.stringify(data) : null
        })
        .then(handleErrors)
        .then(toJson);
}

module.exports = {
    getJson,
    postJson
};