import { Server as BareServer } from './Server.mjs';
import { Server as HTTPServer, Server } from 'node:http';
import { Server as TLSHTTPServer } from 'node:https';
import { readFile } from 'node:fs/promises';

import { program, Option } from 'commander';
import { resolve } from 'node:path';

const default_port = Symbol();

program
.addOption(new Option('-d, --directory <URL>', 'Bare URL directory.').default('/'))
.addOption(new Option('-h, --host <string>', 'Hostname to listen on').default('localhost').env('PORT'))
.addOption(new Option('-p, --port <number>', 'Port to listen on').default(default_port).env('PORT'))
.addOption(new Option('--tls', 'use HTTPS (TLS/SSL)'))
.addOption(new Option('--cert <string>', 'certificate for TLS').default(''))
.addOption(new Option('--key <string>', 'key for TLS').default(''))
;

program.parse(process.argv);

const options = program.opts();

const bare = new BareServer(options.directory);
console.info('Created bare server on directory:', options.directory);

let http;

if(options.tls){
	const cwd = process.cwd();
	const tls = {};
	
	if(options.key !== ''){
		options.key = resolve(cwd, options.key);
		console.info('Reading key from file:', options.key);
		tls.key = await readFile(options.key);
	}

	if(options.cert !== ''){
		options.cert = resolve(cwd, options.cert);
		console.info('Reading certificate from file:', options.cert);
		tls.cert = await readFile(options.cert);
	}
	
	http = new TLSHTTPServer(tls);
	console.info('Created TLS HTTP server.');
}else{
	http = new HTTPServer();
	console.info('Created HTTP server.');
}

http.on('request', (req, res) => {
	if(bare.route_request(req, res))return;

	res.writeHead(400);
	res.send('Not found');
});

http.on('upgrade', (req, socket, head) => {
	if(bare.route_upgrade(req, socket, head))return;
	socket.end();
});

if(options.port === default_port){
	if(options.tls){
		options.port = 443;
	}else{
		options.port = 80;
	}
}

http.on('listening', () => {
	console.log(`HTTP server listening. View live at ${options.tls ? 'https:' : 'http:'}//${options.host}:${options.port}${options.directory}`);
});

http.listen({
	host: options.host,
	port: options.port,
});