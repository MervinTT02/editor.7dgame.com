import type { MessageBridge } from './MessageBridge.js';
import type { MrppEditor } from '../types/mrpp.js';

export interface BridgeHandlersConfig {
	bridge: MessageBridge;
	editor: MrppEditor;
	responseActions: Set<string>;
	mapToResponsePayload: ( action: string, data: any ) => Record<string, unknown>;
	/** 获取 loader 的 changed() 方法 */
	getLoaderChanged: () => Promise<boolean>;
	/** 获取编辑器数据用于 save-before-leave */
	getLoaderData: () => Promise<Record<string, unknown>>;
	/** 保存成功后更新 loader 的 json 快照 */
	loaderJsonSetter: ( json: string ) => void;
	/** Additional request handlers keyed by an exact action name. */
	requestHandlers?: Record<
		string,
		( payload: Record<string, unknown> ) =>
			Record<string, unknown> | Promise<Record<string, unknown>>
	>;
}

/**
 * Register the standard bridge communication handlers shared by both
 * meta-bootstrap and verse-bootstrap.
 *
 * This covers:
 * 1. `editor.signals.messageSend` listener — routes messages based on responseActions
 * 2. `bridge.onMessage('INIT')` — dispatches load action + sets user
 * 3. `bridge.onMessage('REQUEST')` — handles check-unsaved-changes, save-before-leave,
 *    and dispatches other actions to editor internal signal system
 * 4. `bridge.onMessage('THEME_CHANGE')` — placeholder
 * 5. `bridge.onMessage('DESTROY')` — calls bridge.destroy()
 */
export function setupBridgeHandlers( config: BridgeHandlersConfig ): void {

	const { bridge, editor, responseActions, mapToResponsePayload,
		getLoaderChanged, getLoaderData, loaderJsonSetter } = config;

	// ── 1. messageSend listener ──────────────────────────────────────

	editor.signals.messageSend.add( function ( e: any ) {

		const action = e.action;

		if ( action === 'ready' ) {

			// ready is handled by bridge.init() sending PLUGIN_READY
			return;

		}

		if ( responseActions.has( action ) ) {

			bridge.postResponse( mapToResponsePayload( action, e.data ) );

		} else {

			bridge.postMessage( 'EVENT', { event: action, ...( e.data || {} ) } );

		}

	} );

	// ── 2. INIT handler ──────────────────────────────────────────────

	bridge.onMessage( 'INIT', ( payload: any ) => {

		const config = payload.config;

		// Dispatch to editor.signals.messageReceive so internal components
		// (loader, menubar, sidebar) receive the data via the existing signal.
		editor.signals.messageReceive.dispatch( {
			action: 'load',
			data: config
		} );

		// Set user info from INIT config (replaces old separate 'user-info' message)
		if ( config.user ) {

			if ( ! editor.data ) editor.data = {};
			editor.data.user = config.user;
			console.log( 'Set user role from INIT:', editor.data.user.role );

		}

	} );

	// ── 3. REQUEST handler ───────────────────────────────────────────

	bridge.onMessage( 'REQUEST', ( payload: any, message ) => {

		const action = payload.action;

		if ( action === 'check-unsaved-changes' ) {

			( async () => {

				let changed = false;
				try {

					changed = await getLoaderChanged();

				} catch ( error ) {

					console.error( 'Failed to check unsaved changes:', error );

				}

				bridge.postResponse( {
					action: 'check-unsaved-changes',
					changed: Boolean( changed )
				}, message.id );

			} )();
			return;

		}

		if ( action === 'save-before-leave' ) {

			( async () => {

				try {

					const changed = await getLoaderChanged();

					if ( ! changed ) {

						bridge.postResponse( {
							action: 'save-before-leave',
							noChange: true
						}, message.id );
						return;

					}

					const responsePayload = await getLoaderData();
					bridge.postResponse( {
						action: 'save-before-leave',
						...responsePayload
					}, message.id );
					loaderJsonSetter( JSON.stringify( responsePayload ) );

				} catch ( error ) {

					console.error( 'Failed to save before leave:', error );
					bridge.postResponse( {
						action: 'save-before-leave',
						noChange: true
					}, message.id );

				}

			} )();
			return;

		}

		const customHandler = config.requestHandlers?.[ action ];
		if ( customHandler ) {

			( async () => {

				try {

					const response = await customHandler( payload );
					bridge.postResponse( { action, ...response }, message.id );

				} catch ( error ) {

					bridge.postResponse( {
						action,
						ok: false,
						code: 'HANDLER_ERROR',
						error: error instanceof Error ? error.message : String( error )
					}, message.id );

				}

			} )();
			return;

		}

		// Other REQUEST actions → dispatch to editor internal signal system
		editor.signals.messageReceive.dispatch( {
			action: action,
			data: payload,
			requestId: message.id
		} );

	} );

	// ── 4. THEME_CHANGE handler ──────────────────────────────────────

	bridge.onMessage( 'THEME_CHANGE', ( _payload: any ) => {

		// Placeholder for theme handling — Editor currently has no dark mode support

	} );

	// ── 5. DESTROY handler ───────────────────────────────────────────

	bridge.onMessage( 'DESTROY', () => {

		bridge.destroy();

	} );

}
