import searchIcon from "@/assets/icons/left-bar/navigation/magnifying-glass.svg";
import { SearchBarProps } from "@interfaces/interfaces";
import appStore from "@store/app";
import { memo } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import React from "react";
import * as styles from "./SearchBar.module.scss";

const platformMatchers: Record<string, RegExp> = {
	windows: /windows nt/i,
	mac: /mac(?:intosh| os x)/i,
	mobile: /mobile|android|iphone|ipad|ipod/i,
	linux: /linux/i,
};

const getPlatform = (): string => {
	const userAgent = navigator.userAgent.toLowerCase();
	for (const [platform, regex] of Object.entries(platformMatchers)) {
		if (regex.test(userAgent)) return platform;
	}
	return "unknown";
};

const getShortcut = (platform: string): string => {
	switch (platform) {
		case "mac":
			return "⌘+K";
		case "windows":
			return "Ctrl + K";
		case "linux":
			return "Ctrl + Shift + K";
		default:
			return "";
	}
};

const SearchBar = ({ onJoinChannel }: SearchBarProps) => {
	const [query, setQuery] = useState("");
	const [platform] = useState(getPlatform());
	const [isSearchActive, setSearchActive] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleKeyPress = async (e: KeyboardEvent) => {
		if (e.key !== "Enter") return;

		const trimmed = query.trim();
		const channelId = parseInt(trimmed, 10);
		if (!trimmed || !Number.isInteger(channelId)) return;

		try {
			await appStore.joinChannel(channelId);
			await onJoinChannel(channelId);

			setQuery("");
			setSearchActive(false);
		} catch (error) {
			console.error("Channel join error:", error);
			alert("Couldn't find or join this chat-list");
		}
	};

	useEffect(() => {
		const input = inputRef.current;
		if (!input) return;

		const listener = (e: KeyboardEvent) => {
			void handleKeyPress(e);
		};

		input.addEventListener("keypress", listener);
		return () => {
			input.removeEventListener("keypress", listener);
		};
	}, [query]);

	useEffect(() => {
		const ctrlPlatforms = ["windows", "linux"];
		const handleKeyDown = (event: KeyboardEvent) => {
			const isShortcut =
				(platform === "mac" && event.metaKey && event.code === "KeyK") ||
				(ctrlPlatforms.includes(platform) &&
					event.ctrlKey &&
					event.code === "KeyK");

			if (isShortcut) {
				event.preventDefault();
				activateSearch();
			} else if (event.code === "Escape" && isSearchActive) {
				deactivateSearch();
			}
		};

		const activateSearch = () => {
			setSearchActive(true);
			inputRef.current?.focus();
		};

		const deactivateSearch = () => {
			setSearchActive(false);
			setQuery("");
			inputRef.current?.blur();
		};

		window.addEventListener("keydown", handleKeyDown, true);
		return () => {
			window.removeEventListener("keydown", handleKeyDown, true);
		};
	}, [platform, isSearchActive]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const target = e.target as HTMLInputElement | null;
		if (target) {
			setQuery(target.value);
		}
	};

	return (
		<div className={styles.searchContainer}>
			<div
				className={`${styles.searchBar} ${isSearchActive ? styles.active : ""}`}
			>
				<img src={searchIcon} alt="Search" className={styles.searchIcon} />
				<input
					ref={inputRef}
					type="text"
					value={query}
					onInput={handleChange}
					placeholder={`Search or enter channel ID (${getShortcut(platform)})`}
					className={`${styles.searchInput}`}
				/>
			</div>
		</div>
	);
};

export default memo(SearchBar);
