/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { languages as Languages, Disposable, TextDocument, ProviderResult, Position as VPosition, Definition as VDefinition, DefinitionLink as VDefinitionLink } from 'vscode';

import {
	ClientCapabilities, CancellationToken, ServerCapabilities, DocumentSelector, ImplementationRequest
} from 'vscode-languageserver-protocol';

import { TextDocumentFeature, BaseLanguageClient } from './client';
import { ImplementationRegistrationOptions, ImplementationOptions } from 'vscode-languageserver-protocol/lib/protocol.implementation';

function ensure<T, K extends keyof T>(target: T, key: K): T[K] {
	if (target[key] === void 0) {
		target[key] = {} as any;
	}
	return target[key];
}

export interface ProvideImplementationSignature {
	(document: TextDocument, position: VPosition, token: CancellationToken): ProviderResult<VDefinition | VDefinitionLink[]>;
}

export interface ImplementationMiddleware {
	provideImplementation?: (this: void, document: TextDocument, position: VPosition, token: CancellationToken, next: ProvideImplementationSignature) => ProviderResult<VDefinition | VDefinitionLink[]>;
}

export class ImplementationFeature extends TextDocumentFeature<boolean | ImplementationOptions, ImplementationRegistrationOptions> {

	constructor(client: BaseLanguageClient) {
		super(client, ImplementationRequest.type);
	}

	public fillClientCapabilities(capabilites: ClientCapabilities): void {
		let implementationSupport = ensure(ensure(capabilites, 'textDocument')!, 'implementation')!;
		implementationSupport.dynamicRegistration = true;
		implementationSupport.linkSupport = true;
	}

	public initialize(capabilities: ServerCapabilities, documentSelector: DocumentSelector): void {
		let [id, options] = this.getRegistration(documentSelector, capabilities.implementationProvider);
		if (!id || !options) {
			return;
		}
		this.register(this.messages, { id: id, registerOptions: options });
	}

	protected registerLanguageProvider(options: ImplementationRegistrationOptions): Disposable {
		let client = this._client;
		let provideImplementation: ProvideImplementationSignature = (document, position, token) => {
			return client.sendRequest(ImplementationRequest.type, client.code2ProtocolConverter.asTextDocumentPositionParams(document, position), token).then(
				client.protocol2CodeConverter.asDefinitionResult,
				(error) => {
					client.logFailedRequest(ImplementationRequest.type, error);
					return Promise.resolve(null);
				}
			);
		};
		let middleware = client.clientOptions.middleware!;
		return Languages.registerImplementationProvider(options.documentSelector!, {
			provideImplementation: (document: TextDocument, position: VPosition, token: CancellationToken): ProviderResult<VDefinition | VDefinitionLink[]> => {
				return middleware.provideImplementation
					? middleware.provideImplementation(document, position, token, provideImplementation)
					: provideImplementation(document, position, token);
			}
		});
	}
}


