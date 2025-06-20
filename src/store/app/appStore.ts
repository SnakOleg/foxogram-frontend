import type { WebSocketClient } from "@/gateway/webSocketClient";
import { apiMethods } from "@services/API/apiMethods";
import { Logger } from "@utils/logger";
import {
	APIChannel,
	APIMessage,
	RESTGetAPIMessageListQuery,
} from "foxochat.js";
import {
	IObservableArray,
	action,
	configure,
	observable,
	reaction,
	runInAction,
} from "mobx";
import * as apiService from "./apiService";
import { transformToMessage } from "./transforms";
import * as wsService from "./websocketService";

configure({ enforceActions: "observed" });

export class AppStore {
	@observable accessor messagesByChannelId = observable.map<
		number,
		IObservableArray<APIMessage>
	>();
	@observable accessor hasMoreMessagesByChannelId = observable.map<
		number,
		boolean
	>();
	@observable accessor isInitialLoad = observable.map<number, boolean>();
	@observable accessor channels: IObservableArray<APIChannel> =
		observable.array([]);
	@observable accessor activeRequests = observable.set<number>();
	@observable accessor currentChannelId: number | null = null;
	@observable accessor currentUserId: number | null = null;
	@observable accessor isLoading = false;
	@observable accessor isSendingMessage = false;
	@observable accessor connectionError: string | null = null;
	@observable accessor isWsInitialized = false;
	@observable accessor isLoadingHistory = false;
	@observable accessor channelDisposers = observable.map<number, () => void>();
	@observable accessor isCurrentChannelScrolledToBottom = true;
	@observable accessor unreadCount = observable.map<number, number>();
	@observable accessor channelScrollPositions = observable.map<
		number,
		number
	>();

	wsClient: WebSocketClient | null = null;

	constructor() {
		this.initializeFromUrl().catch((error) => {
			Logger.error(`Failed to initialize from URL: ${error}`);
		});
	}

	@action
	async initChannel(channelId: number) {
		if (this.messagesByChannelId.has(channelId)) return;

		this.activeRequests.add(channelId);
		this.isInitialLoad.set(channelId, true);
		await this.fetchInitialMessages(channelId, { limit: 50 }).finally(() => {
			runInAction(() => {
				this.activeRequests.delete(channelId);
				this.isInitialLoad.set(channelId, false);
			});
		});
	}

	@action
	setIsCurrentChannelScrolledToBottom(value: boolean) {
		if (this.currentChannelId !== null && value) {
			this.unreadCount.set(this.currentChannelId, 0);
		}
		this.isCurrentChannelScrolledToBottom = value;
	}

	@action
	setIsSendingMessage(state: boolean) {
		this.isSendingMessage = state;
	}

	@action
	updateMessagesForChannel(channelId: number, messages: APIMessage[]) {
		const existing =
			this.messagesByChannelId.get(channelId) || observable.array([]);
		const updated = Array.from(
			new Map([...existing, ...messages].map((msg) => [msg.id, msg])).values(),
		).sort((a, b) => a.created_at - b.created_at);
		this.messagesByChannelId.set(channelId, observable.array(updated));
	}

	@action
	handleNewMessage(message: APIMessage) {
		const channelId = message.channel.id;
		const messages =
			this.messagesByChannelId.get(channelId) || observable.array([]);

		if (!messages.some((m) => m.id === message.id)) {
			messages.push(message);
			this.messagesByChannelId.set(
				channelId,
				observable.array(
					[...messages].sort((a, b) => a.created_at - b.created_at),
				),
			);

			if (
				this.currentChannelId === channelId &&
				!this.isCurrentChannelScrolledToBottom
			) {
				this.unreadCount.set(
					channelId,
					(this.unreadCount.get(channelId) || 0) + 1,
				);
			} else if (this.currentChannelId === channelId) {
				this.playSendMessageSound();
			}
		}

		const channelIndex = this.channels.findIndex((c) => c.id === channelId);
		if (channelIndex >= 0) {
			this.channels[channelIndex].last_message = message;
		}
	}

	@action
	setIsLoading(isLoading: boolean) {
		this.isLoading = isLoading;
	}

	@action
	async joinChannel(channelId: number) {
		const joined = await apiMethods.joinChannel(channelId);
		if (!this.channels.some((c) => c.id === channelId)) {
			this.channels.unshift(joined.channel);
		}
		await this.setCurrentChannel(channelId);
	}

	@action
	async initializeFromUrl() {
		const hash = window.location.hash.substring(1);
		if (!hash || isNaN(Number(hash))) return;
		const channelId = Number(hash);

		if (!this.channels.length) {
			await this.fetchChannelsFromAPI();
		}

		if (this.channels.some((c) => c.id === channelId)) {
			await this.setCurrentChannel(channelId);
		}
	}

	@action
	setCurrentUser(userId: number) {
		this.currentUserId = userId;
	}

	@action
	setHasMoreMessages(channelId: number, hasMore: boolean) {
		this.hasMoreMessagesByChannelId.set(channelId, hasMore);
	}

	@action
	updateMessage(messageId: number, newContent: string) {
		const cid = this.currentChannelId;
		if (!cid) return;

		const msgs = this.messagesByChannelId.get(cid);
		if (!msgs) return;

		const idx = msgs.findIndex((m) => m.id === messageId);
		if (idx >= 0) {
			msgs[idx] = { ...msgs[idx], content: newContent };
		}
	}

	@action
	deleteMessage(messageId: number) {
		const cid = this.currentChannelId;
		if (!cid) return;

		const msgs = this.messagesByChannelId.get(cid);
		if (msgs) {
			this.messagesByChannelId.set(
				cid,
				observable.array(msgs.filter((m) => m.id !== messageId)),
			);
		}
	}

	@action
	async setCurrentChannel(channelId: number | null) {
		const previousChannelId = this.currentChannelId;
		this.currentChannelId = channelId;

		if (previousChannelId !== null) {
			const disposer = this.channelDisposers.get(previousChannelId);
			if (disposer) {
				disposer();
				this.channelDisposers.delete(previousChannelId);
			}
		}

		if (channelId !== null) {
			localStorage.setItem("currentChannelId", String(channelId));
			if (!this.messagesByChannelId.has(channelId)) {
				this.messagesByChannelId.set(channelId, observable.array([]));
			}
			this.isLoadingHistory = false;
			this.activeRequests.delete(channelId);
			await this.fetchInitialMessages(channelId);

			const disposer = reaction(
				() => this.messagesByChannelId.get(channelId)?.length ?? 0,
				(length) => {
					if (this.currentChannelId === channelId && length > 0) {
						requestAnimationFrame(() => {
							const container = document.getElementById("messageList");
							if (container && this.isCurrentChannelScrolledToBottom) {
								container.scrollTop = 0;
							}
						});
					}
				},
			);
			this.channelDisposers.set(channelId, disposer);
		}
	}

	@action
	async fetchInitialMessages(
		channelId: number,
		query: RESTGetAPIMessageListQuery = {},
	) {
		if (this.activeRequests.has(channelId)) return;

		this.activeRequests.add(channelId);
		this.isLoadingHistory = true;

		try {
			const defaultQuery: RESTGetAPIMessageListQuery = { limit: 50, ...query };
			const newMessages = await apiMethods.listMessages(
				channelId,
				defaultQuery,
			);

			const transformed = newMessages.map(transformToMessage);

			runInAction(() => {
				console.log("Fetched initial messages:", newMessages.length);
				const existing =
					this.messagesByChannelId.get(channelId) || observable.array([]);

				let updated = [...transformed, ...existing];
				const unique = new Map<number, APIMessage>();
				updated.forEach((msg) => unique.set(msg.id, msg));
				updated = Array.from(unique.values()).sort(
					(a, b) => a.created_at - b.created_at,
				);

				this.messagesByChannelId.set(channelId, observable.array(updated));
				this.hasMoreMessagesByChannelId.set(
					channelId,
					newMessages.length >= 50,
				);
			});
		} catch (error) {
			Logger.error(`Failed to fetch initial messages: ${error}`);
		} finally {
			runInAction(() => {
				this.activeRequests.delete(channelId);
				this.isLoadingHistory = false;
			});
		}
	}

	@action
	async fetchOlderMessages(channelId: number, beforeTimestamp: number) {
		if (this.activeRequests.has(channelId)) {
			Logger.info(
				`Fetch older messages for channel ${channelId} skipped: already in progress`,
			);
			return;
		}

		this.activeRequests.add(channelId);
		this.isLoadingHistory = true;

		try {
			Logger.info(
				`Fetching older messages with before timestamp=${beforeTimestamp}`,
			);
			const newMessages = await apiMethods.listMessages(channelId, {
				limit: 100,
				before: beforeTimestamp,
			});

			if (newMessages.length === 0) {
				runInAction(() => {
					this.hasMoreMessagesByChannelId.set(channelId, false);
				});
				return;
			}

			const transformed = newMessages.map(transformToMessage);

			runInAction(() => {
				Logger.info(
					`Fetched ${newMessages.length} older messages for channel ${channelId}`,
				);
				const existingMessages =
					this.messagesByChannelId.get(channelId) || observable.array([]);

				const existingIds = new Set(existingMessages.map((msg) => msg.id));
				const uniqueNewMessages = transformed.filter(
					(msg) => !existingIds.has(msg.id),
				);

				if (uniqueNewMessages.length > 0) {
					const updatedMessages = [...uniqueNewMessages, ...existingMessages];
					this.messagesByChannelId.set(
						channelId,
						observable.array(updatedMessages),
					);
				}

				this.hasMoreMessagesByChannelId.set(
					channelId,
					newMessages.length >= 100,
				);
			});
		} catch (error) {
			Logger.error(
				`Failed to fetch older messages for channel ${channelId}: ${error}`,
			);
		} finally {
			runInAction(() => {
				this.activeRequests.delete(channelId);
				this.isLoadingHistory = false;
			});
		}
	}

	@action
	async initializeStore() {
		try {
			this.setIsLoading(true);
			Logger.info("Starting store initialization...");
			await this.fetchCurrentUser();
			Logger.info("Current user fetched successfully");
			await this.fetchChannelsFromAPI();
			Logger.info("Channels fetched successfully");
			await this.initializeWebSocket();
			Logger.info("WebSocket initialized successfully");
		} catch (error) {
			Logger.error(`Initialization failed: ${error}`);
			this.connectionError = "Initialization error";
		} finally {
			this.setIsLoading(false);
		}
	}

	@action
	addNewChannel(channel: APIChannel) {
		const observableChannel = observable.object(channel);
		if (!this.channels.some((c) => c.id === observableChannel.id)) {
			this.channels.unshift(observableChannel);
		}
	}

	playSendMessageSound() {
		const audio = new Audio("/sounds/fchat_sfx.mp3");
		audio.play().catch(console.error);
	}

	fetchCurrentUser = apiService.fetchCurrentUser;
	fetchChannelsFromAPI = apiService.fetchChannelsFromAPI;
	sendMessage = apiService.sendMessage;
	retryMessage = apiService.retryMessage;

	clearAuthAndRedirect = wsService.clearAuthAndRedirect;
	initializeWebSocket = wsService.initializeWebSocket;
	handleHistorySync = wsService.handleHistorySync;
	setupWebSocketHandlers = wsService.setupWebSocketHandlers;
}
