self.importScripts('/js/satriani.js');

function output(...args) {
    self.postMessage({ output: args });
}

self.addEventListener('message', function(msg) {    
    var data = msg.data;
    switch(data.command) {
        case 'run':
            runRockstar(data);
            break;
        case 'stop':
            self.close();
            break;
    }
});

function runRockstar(data) {
    var source = data.source;
    let input = () => data.input.shift();
    let output = (...args) => self.postMessage({ type: 'output', data: args });
    let rockstar = new Satriani.Interpreter(output);
    try {
        let program = rockstar.parse(source);
        self.postMessage({ type: 'parser', data: program });
        let result = rockstar.run(source, input, output);
        self.postMessage({ type: 'done', data: result});        
    } catch (e) {
        self.postMessage({type : 'error', data: e});
    }
    self.close();
}