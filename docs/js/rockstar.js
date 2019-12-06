function output(string) {
    document.getElementById('program-output').value += string + '\n';
}

function handleMessage(e) {
    console.log(e);
    switch (e.data.type) {
        // case 'parser':
        //     console.log(JSON.stringify(e.data.data, null, 2)); 
        //     break;
        case 'output':
            output(e.data.data);
            break;
        case 'error':
            let source = document.getElementById('program-source').value + "\n\n\n\n\n";
            let err = e.data.data;
            if (err.location && err.location.start) {
                let lines = source.split(/\n/);
                output(lines[err.location.start.line - 1]);
                output(' '.repeat(err.location.start.column - 1) + '^');
                output(err.message);
                output("line " + err.location.start.line + " col " + err.location.start.column);
            } else {
                output(err);
            }
            stop();
            break;
        case 'done':
            var executionTime = new Date() - window.executionStarted;
            output(`Program completed in ${executionTime} ms`);
            if (typeof (e.data.data) != 'undefined') output("Result: " + e.data.data);
            stop();
            break;
    }
}

function rock() {
    window.executionStarted = new Date();
    $("#program-output").addClass("running");
    $("#rock-button").attr('disabled', 'disabled');
    document.getElementById('program-output').value = '';
    let input = document.getElementById('program-input').value.split(/\r?\n/);
    let source = document.getElementById('program-source').value + "\n\n\n\n\n";
    window.rockstarWorker = new Worker('/js/worker.js');
    window.rockstarWorker.addEventListener('message', handleMessage);
    window.rockstarWorker.postMessage({ command: 'run', source: source, input: input });
}

function stop() {
    if (window.rockstarWorker && window.rockstarWorker.terminate) window.rockstarWorker.terminate();
    window.rockstarWorker = undefined;
    $("#program-output").removeClass("running");
    $("#rock-button").removeAttr('disabled');
    return false;
}

$(function () {
    loadSources();
    $("#enable-input-buffer").change(function (e) {
        if (this.checked) {
            $("#program-input-wrapper").slideDown();
        } else {
            $("#program-input-wrapper").slideUp();
        }
    });
    $('#program-source').keydown(function (e) {
        if ((e.metaKey || e.ctrlKey) && e.keyCode == 13) rock();
    });
    $("#cancel-execution").click(function () {
        return(stop());
    });
});

function loadSources() {
    if (location.search && location.search.split) {
        pairs = location.search.substring(1).split('&');
        for (var i = 0; i < pairs.length; i++) {
            if (pairs[i] && pairs[i].split) bits = pairs[i].split('=');
            if (bits[0] == 'source') {
                console.log('loading source ' + bits[1]);
                load('program-source', bits[1]);
            }
            if (bits[0] == 'input') load('program-input', bits[1]);
        }
    }
}

function load(elementId, url) {
    $.get(url, function (data) {
        document.getElementById(elementId).value = data;
    });
    return (false);
}