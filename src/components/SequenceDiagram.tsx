import React, { useCallback, useMemo, useRef, useState } from "react";
import styles from "./SequenceDiagram.module.css";

export type SequenceParticipant = {
	id: string;
	name: string;
};

export type SequenceMessagePopup = {
	message: string;
	[key: string]: string;
};

export type SequenceMessageEvent = {
	id: string;
	label?: string;
	/** Arbitrary payload that will be shown as formatted JSON in the popup. */
	payload: unknown;
};

export type SequenceMessage = {
	from: string;
	to: string;
	label?: string;
	kind?: "sync" | "async" | "return" | "note";
	/** Optional timestamp (number). Used for time-window filtering in the toolbar. */
	timestamp?: number;
	/** If true, visually emphasizes the label (e.g., blurred background behind label). */
	highlightLabel?: boolean;
	popup?: SequenceMessagePopup;
	/** Optional structured events shown as an accordion inside the popup. */
	events?: SequenceMessageEvent[];
};

export type SequenceDiagramProps = {
	participants: SequenceParticipant[];
	messages: SequenceMessage[];
	config?: {
		showLabelsMode?: "always" | "hover";
		/** Overall color style for the diagram. */
		colorMode?: "color" | "mono";
		/** Controls visibility of the participant header labels. */
		showParticipantLabels?: boolean;
		hMargin?: number;
		vMargin?: number;
		participantWidth?: number;
		participantHeight?: number;
		lifelineGapX?: number;
		messageGapY?: number;
		firstMessageOffset?: number;
		noteWidth?: number;
		fontFamily?: string;
	};
	/** If provided, sets the SVG width (e.g., 800 or "100%"). Defaults to "100%". */
	width?: number | string;
	/** If provided, sets the outer container height (e.g., 600 or "100%"). Defaults to "auto". */
	height?: number | string;
	/** Shows a toolbar with view controls (color mode, labels, participant filter). Defaults to true. */
	showToolbar?: boolean;
	className?: string;
	style?: React.CSSProperties;
};

type Layout = {
	width: number;
	height: number;
	participantCenters: number[];
	messageY: number[];
	topBandHeight: number;
};

type PopupState = {
	title: string;
	participants: string[];
	content?: SequenceMessagePopup;
	position: { x: number; y: number };
	events?: SequenceMessageEvent[];
	expandedEventId?: string | null;
	rawMessage?: SequenceMessage;
};

const DEFAULTS = {
	showLabelsMode: "always" as const,
	colorMode: "color" as const,
	showParticipantLabels: true,
	hMargin: 32,
	vMargin: 32,
	participantWidth: 140,
	participantHeight: 44,
	lifelineGapX: 200,
	messageGapY: 72,
	firstMessageOffset: 48,
	noteWidth: 200,
	fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
};

const PARTICIPANT_COLORS = ["#2563eb", "#db2777", "#059669", "#f97316", "#9333ea", "#0ea5e9", "#14b8a6", "#f59e0b"];

const STORAGE_KEY = "sequence-diagram:settings";

function buildLayout(participantCount: number, messageCount: number, cfg: Required<NonNullable<SequenceDiagramProps["config"]>>, participantNames?: string[]): Layout {
	// Calculate dynamic participant widths based on name length
	const participantWidths = participantNames
		? participantNames.map(name => Math.max(cfg.participantWidth, name.length * 8 + 24))
		: new Array(participantCount).fill(cfg.participantWidth);
	
	// Calculate total width needed for all participants with proper spacing
	const totalParticipantWidth = participantWidths.reduce((sum, w) => sum + w, 0);
	const spacingBetweenParticipants = Math.max(0, participantCount - 1) * 60; // minimum 60px between participant centers
	const width = cfg.hMargin * 2 + totalParticipantWidth + spacingBetweenParticipants;
	
	// Calculate participant centers accounting for dynamic widths
	const participantCenters: number[] = [];
	let currentX = cfg.hMargin + participantWidths[0] / 2;
	participantCenters.push(currentX);
	
	for (let i = 1; i < participantCount; i++) {
		currentX += participantWidths[i - 1] / 2 + participantWidths[i] / 2 + 60; // 60px spacing between centers
		participantCenters.push(currentX);
	}
	
	const topBandHeight = cfg.vMargin + cfg.participantHeight;
	const bottomMargin = cfg.vMargin / 2;
	const height = topBandHeight + cfg.firstMessageOffset + bottomMargin + Math.max(0, messageCount) * cfg.messageGapY;
	const messageY = new Array(messageCount)
		.fill(0)
		.map((_, i) => topBandHeight + cfg.firstMessageOffset + i * cfg.messageGapY);
	return { width, height, participantCenters, messageY, topBandHeight };
}

function ArrowMarkerDefs() {
	return (
		<defs>
			<marker id="arrow-solid" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto-start-reverse">
				<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
			</marker>
			<marker id="arrow-open" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto-start-reverse">
				<path d="M 10 5 L 0 0 M 10 5 L 0 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
			</marker>
			<filter id="label-blur" x="-40%" y="-40%" width="180%" height="180%">
				<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
				<feColorMatrix
					in="blur"
					type="matrix"
					values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.35 0"
				/>
			</filter>
		</defs>
	);
}

export function SequenceDiagram({
	participants,
	messages,
	config,
	width,
	height,
	showToolbar = true,
	className,
	style
}: SequenceDiagramProps) {
	const cfg = { ...DEFAULTS, ...(config ?? {}) };
	const [colorMode, setColorMode] = useState<"color" | "mono">(() => {
		if (typeof window === "undefined") return cfg.colorMode;
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			if (!raw) return cfg.colorMode;
			const parsed = JSON.parse(raw) as { colorMode?: "color" | "mono" };
			return parsed.colorMode ?? cfg.colorMode;
		} catch {
			return cfg.colorMode;
		}
	});
	const [showParticipantLabels, setShowParticipantLabels] = useState<boolean>(() => {
		if (typeof window === "undefined") return cfg.showParticipantLabels;
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			if (!raw) return cfg.showParticipantLabels;
			const parsed = JSON.parse(raw) as { showParticipantLabels?: boolean };
			return parsed.showParticipantLabels ?? cfg.showParticipantLabels;
		} catch {
			return cfg.showParticipantLabels;
		}
	});
	const [visibleParticipantIds, setVisibleParticipantIds] = useState<string[] | null>(() => {
		if (typeof window === "undefined") return null;
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as { visibleParticipantIds?: string[] | null };
			if (!parsed.visibleParticipantIds) return null;
			// Filter out any ids that no longer exist.
			const validIds = parsed.visibleParticipantIds.filter((id) => participants.some((p) => p.id === id));
			return validIds.length ? validIds : null;
		} catch {
			return null;
		}
	});
	const [timeRange, setTimeRange] = useState<{ min: number; max: number } | null>(() => {
		if (typeof window === "undefined") return null;
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as { timeRange?: { min: number; max: number } | null };
			return parsed.timeRange ?? null;
		} catch {
			return null;
		}
	});
	const [isFilterOpen, setIsFilterOpen] = useState(false);
	const [hoveredMsgIndex, setHoveredMsgIndex] = useState<number | null>(null);
	const [popup, setPopup] = useState<PopupState | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const timeStats = useMemo(() => {
		let min = Infinity;
		let max = -Infinity;
		let count = 0;
		for (const m of messages) {
			if (typeof m.timestamp === "number" && !Number.isNaN(m.timestamp)) {
				if (m.timestamp < min) min = m.timestamp;
				if (m.timestamp > max) max = m.timestamp;
				count++;
			}
		}
		if (count === 0) {
			return { hasAny: false as const, min: 0, max: 0 };
		}
		return { hasAny: true as const, min, max };
	}, [messages]);

	const activeTimeRange = useMemo(() => {
		if (!timeStats.hasAny) return null;
		if (!timeRange) return { min: timeStats.min, max: timeStats.max };
		return {
			min: Math.max(timeStats.min, timeRange.min),
			max: Math.min(timeStats.max, timeRange.max)
		};
	}, [timeStats, timeRange]);

	const filteredMessages = useMemo(() => {
		if (!activeTimeRange) return messages;
		const { min, max } = activeTimeRange;
		return messages.filter((m) => {
			if (typeof m.timestamp !== "number" || Number.isNaN(m.timestamp)) {
				// Messages without timestamp are always shown.
				return true;
			}
			return m.timestamp >= min && m.timestamp <= max;
		});
	}, [messages, activeTimeRange]);

	const visibleParticipants = useMemo(
		() =>
			visibleParticipantIds
				? participants.filter((p) => visibleParticipantIds.includes(p.id))
				: participants,
		[participants, visibleParticipantIds]
	);

	const layout = useMemo(
		() => buildLayout(visibleParticipants.length, filteredMessages.length, cfg, visibleParticipants.map(p => p.name)),
		[
			visibleParticipants.length,
			filteredMessages.length,
			cfg.hMargin,
			cfg.vMargin,
			cfg.participantWidth,
			cfg.participantHeight,
			cfg.lifelineGapX,
			cfg.messageGapY,
			cfg.firstMessageOffset,
			visibleParticipants
		]
	);

	// Sorted list for the participant filter dropdown: any participant with
	// "client" in the name (case-insensitive) goes first, then the rest
	// are sorted alphabetically by name.
	const sortedParticipantsForFilter = useMemo(() => {
		if (!participants) return [] as typeof participants;
		const arr = participants.slice();
		const clientItems = arr.filter((p) => /client/i.test(p.name));
		const others = arr.filter((p) => !/client/i.test(p.name));
		others.sort((a, b) => a.name.localeCompare(b.name));
		return [...clientItems, ...others];
	}, [participants]);

	const headerHeight = layout.topBandHeight;
	const bodyHeight = Math.max(0, layout.height - headerHeight);
	const bottomMargin = cfg.vMargin / 2;

	const participantColors = useMemo(
		() =>
			colorMode === "mono"
				? visibleParticipants.map(() => "#111827")
				: visibleParticipants.map((_, idx) => PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length]),
		[visibleParticipants, colorMode]
	);

	const lifelineLabelPositions = useMemo(() => {
		if (bodyHeight <= 0) return [];
		const spacing = Math.max(120, cfg.messageGapY) * 2;
		const positions: number[] = [];
		for (let y = 24; y <= bodyHeight - 24; y += spacing) {
			positions.push(y);
		}
		if (positions.length === 0) {
			positions.push(bodyHeight / 2);
		}
		return positions;
	}, [bodyHeight, cfg.messageGapY]);

	// Persist toolbar settings, visible participants and time filter.
	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const payload = {
			colorMode,
			showParticipantLabels,
			visibleParticipantIds,
			timeRange: activeTimeRange
		};
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
		} catch {
			// Ignore storage errors (e.g., quota, disabled storage).
		}
	}, [colorMode, showParticipantLabels, visibleParticipantIds, activeTimeRange]);

	const handleLabelClick = useCallback(
		(
			evt: React.MouseEvent<SVGTextElement, MouseEvent>,
			payload: {
				title: string;
				participants: string[];
				content?: SequenceMessagePopup;
				events?: SequenceMessageEvent[];
				rawMessage?: SequenceMessage;
			}
		) => {
			evt.stopPropagation();
			if (!containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			setPopup({
				title: payload.title,
				content: payload.content,
				participants: payload.participants,
				events: payload.events,
				rawMessage: payload.rawMessage,
				expandedEventId: null,
				position: {
					x: evt.clientX - rect.left,
					y: evt.clientY - rect.top
				}
			});
		},
		[]
	);

	const closePopup = useCallback(() => setPopup(null), []);

	const renderParticipantBar = () =>
		visibleParticipants.map((p, i) => {
			const cx = layout.participantCenters[i];
			const accent = participantColors[i];
			// Dynamically size the participant rectangle based on the label length,
			// with a minimum width from the config.
			const estimatedLabelWidth = p.name.length * 8 + 24; // rough estimate: 8px per char + padding
			const rectWidth = Math.max(cfg.participantWidth, estimatedLabelWidth);
			return (
				<g key={p.id}>
					<rect
						x={cx - rectWidth / 2}
						y={cfg.vMargin}
						rx={6}
						ry={6}
						width={rectWidth}
						height={cfg.participantHeight}
						fill="#ffffff"
						stroke={accent}
						strokeWidth={1.5}
					/>
					<line
						x1={cx}
						y1={cfg.vMargin + cfg.participantHeight}
						x2={cx}
						y2={headerHeight}
						stroke={accent}
						strokeDasharray="6 6"
					/>
					<text
						x={cx}
						y={cfg.vMargin + cfg.participantHeight / 2 + 4}
						textAnchor="middle"
						fontSize={12}
						fill="#000000"
						fontWeight={500}
					>
						{p.name}
					</text>
				</g>
			);
		});

	// Split rendering: sticky header and scrollable body with shared horizontal scroll.
	const outerHeightStyle = height != null ? { height } : undefined;

	const rootClassName = [styles.diagramRoot, className].filter(Boolean).join(" ");

	return (
		<div
			ref={containerRef}
			className={rootClassName}
			style={{
				width: "100%",
				position: "relative",
				display: "flex",
				flexDirection: "column",
				minHeight: 0,
				...outerHeightStyle,
				...style
			}}
			onClick={closePopup}
		>
			{showToolbar ? (
				<div className={styles.toolbar}>
					<div className={styles.toolbarLeft}>
						<span className={styles.toolbarLabel}>View</span>
						<button
							type="button"
							className={`${styles.toolbarButton} ${colorMode === "color" ? styles.toolbarButtonActive : ""}`}
							onClick={() => setColorMode("color")}
						>
							Color
						</button>
						<button
							type="button"
							className={`${styles.toolbarButton} ${colorMode === "mono" ? styles.toolbarButtonActive : ""}`}
							onClick={() => setColorMode("mono")}
						>
							B&amp;W
						</button>
						<label className={styles.toolbarCheckboxItem}>
							<input
								type="checkbox"
								checked={showParticipantLabels}
								onChange={(e) => setShowParticipantLabels(e.target.checked)}
							/>
							<span>Participant labels</span>
						</label>
					</div>
					{timeStats.hasAny ? (
						<div className={styles.toolbarTime}>
							<span className={styles.toolbarLabel}>Time</span>
							<span className={styles.timeRangeLabel}>
								{activeTimeRange
									? `${Math.round(activeTimeRange.min)} – ${Math.round(activeTimeRange.max)}`
									: `${Math.round(timeStats.min)} – ${Math.round(timeStats.max)}`}
							</span>
							<div className={styles.timeRangeInputs}>
								<input
									type="range"
									min={timeStats.min}
									max={timeStats.max}
									step={1}
									value={activeTimeRange ? activeTimeRange.min : timeStats.min}
									onChange={(e) => {
										const newMin = Number(e.target.value);
										setTimeRange((prev) => {
											const current = prev ?? { min: timeStats.min, max: timeStats.max };
											const clampedMin = Math.min(newMin, current.max);
											return { min: clampedMin, max: current.max };
										});
									}}
								/>
								<input
									type="range"
									min={timeStats.min}
									max={timeStats.max}
									step={1}
									value={activeTimeRange ? activeTimeRange.max : timeStats.max}
									onChange={(e) => {
										const newMax = Number(e.target.value);
										setTimeRange((prev) => {
											const current = prev ?? { min: timeStats.min, max: timeStats.max };
											const clampedMax = Math.max(newMax, current.min);
											return { min: current.min, max: clampedMax };
										});
									}}
								/>
							</div>
						</div>
					) : null}
					<div className={styles.toolbarRight}>
						<span className={styles.toolbarLabel}>Participants</span>
						<div className={styles.toolbarDropdown}>
							{(() => {
								const total = participants.length;
								const currentIds =
									visibleParticipantIds ?? participants.map((p) => p.id);
								const selectedCount = currentIds.length;
								let label = "All participants";
								if (selectedCount === 0) {
									label = "No participants";
								} else if (selectedCount !== total) {
									label = `Filtered (${selectedCount}/${total})`;
								}
								return (
									<button
										type="button"
										className={styles.toolbarDropdownButton}
										onClick={(e) => {
											e.stopPropagation();
											setIsFilterOpen((open) => !open);
										}}
									>
										<span>{label}</span>
										<span>▾</span>
									</button>
								);
							})()}
							{isFilterOpen ? (
								<div
									className={styles.toolbarDropdownMenu}
									onClick={(e) => e.stopPropagation()}
								>
									<div className={styles.toolbarDropdownHeader}>
										<span className={styles.toolbarLabel}>Participants</span>
										<div className={styles.toolbarDropdownActions}>
											<button
												type="button"
												className={styles.toolbarSmallButton}
												onClick={() => setVisibleParticipantIds(null)}
											>
												Select all
											</button>
											<button
												type="button"
												className={styles.toolbarSmallButton}
												onClick={() => setVisibleParticipantIds([])}
											>
												Unselect all
											</button>
										</div>
									</div>
									<div className={styles.toolbarCheckboxGroup}>
										{sortedParticipantsForFilter.map((p) => {
											const allSelected = !visibleParticipantIds;
											const checked = allSelected || visibleParticipantIds.includes(p.id);
											return (
												<label key={p.id} className={styles.toolbarCheckboxItem}>
													<input
														type="checkbox"
														checked={checked}
														onChange={(e) => {
															if (e.target.checked) {
																setVisibleParticipantIds((prev) => {
																	if (!prev) {
																		// all were selected; keep all selected
																		return null;
																	}
																	const set = new Set(prev);
																	set.add(p.id);
																	const allIds = participants.map((pp) => pp.id);
																	const allSelectedNow = allIds.every((id) => set.has(id));
																	return allSelectedNow ? null : Array.from(set);
																});
															} else {
																setVisibleParticipantIds((prev) => {
																	const current = prev ?? participants.map((pp) => pp.id);
																	const filtered = current.filter((id) => id !== p.id);
																	return filtered;
																});
															}
														}}
													/>
													<span>{p.name}</span>
												</label>
											);
										})}
									</div>
								</div>
							) : null}
						</div>
					</div>
				</div>
			) : null}
			<div
				className={styles.outerScroll}
				style={{ width: "100%", flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", position: "relative" }}
			>
				<div className={styles.hScroll} style={{ width: "100%", overflowX: "auto", minHeight: 0 }}>
					<div style={{ width: layout.width }}>
						<div className={styles.header} style={{ position: "sticky", top: 0, zIndex: 10 }}>
							<svg
								role="img"
								viewBox={`0 0 ${layout.width} ${headerHeight}`}
								width={width ?? "100%"}
								height={headerHeight}
								preserveAspectRatio="xMinYMin meet"
								style={{ display: "block", color: "currentColor", fontFamily: cfg.fontFamily }}
							>
								{renderParticipantBar()}
							</svg>
						</div>
						<div className={styles.body} style={{ paddingBottom: Math.max(0, headerHeight - bottomMargin) }}>
							<svg
								role="img"
								viewBox={`0 0 ${layout.width} ${bodyHeight}`}
								width={width ?? "100%"}
								height={bodyHeight}
								preserveAspectRatio="xMinYMin meet"
								style={{ display: "block", color: "currentColor", fontFamily: cfg.fontFamily }}
							>
								<ArrowMarkerDefs />
								{visibleParticipants.map((p, i) => {
									const cx = layout.participantCenters[i];
									const accent = participantColors[i];
									return (
										<line
											key={`lifeline-${p.id}`}
											x1={cx}
											y1={0}
											x2={cx}
											y2={Math.max(0, bodyHeight - bottomMargin)}
											stroke={accent}
											strokeDasharray="6 6"
										/>
									);
								})}
								{showParticipantLabels &&
									visibleParticipants.map((p, i) => {
									const cx = layout.participantCenters[i];
									const accent = participantColors[i];
									return (
										<g key={`lifeline-label-${p.id}`} style={{ pointerEvents: "none" }} color={accent}>
											{lifelineLabelPositions.map((yPos, idx) => (
												<text
													key={`label-${idx}`}
													x={cx}
													y={yPos}
													textAnchor="middle"
													fontSize={11}
													fill="#000000"
													opacity={0.75}
													dominantBaseline="middle"
													transform={`rotate(-90 ${cx} ${yPos})`}
												>
													{p.name}
												</text>
											))}
										</g>
									);
								})}
								{filteredMessages.map((m, i) => {
									if (m.kind === "note") {
										const targetIdx = visibleParticipants.findIndex(
											(p) => p.id === m.to || p.id === m.from
										);
										if (targetIdx == null) return null;
										const cx = layout.participantCenters[targetIdx];
										const y = (layout.messageY[i] - headerHeight) + 12;
										const noteX = cx - cfg.noteWidth / 2;
										const noteY = y - 18;
										return (
											<g key={`note-${i}`}>
												<rect
													x={noteX}
													y={noteY}
													rx={6}
													ry={6}
													width={cfg.noteWidth}
													height={36}
													fill="#fffbe6"
													stroke="#f59e0b"
													strokeWidth={1}
												/>
												<text
													x={noteX + 8}
													y={noteY + 22}
													fontSize={12}
													fill="#92400e"
													style={{ cursor: "pointer" }}
													onClick={(evt) =>
														handleLabelClick(evt, {
															title: m.label ?? "",
															participants: [visibleParticipants[targetIdx].name],
															content: m.popup,
															events: m.events,
															rawMessage: m
														})
													}
												>
													{m.label}
												</text>
											</g>
										);
									}

									const fromIdx = visibleParticipants.findIndex((p) => p.id === m.from);
									const toIdx = visibleParticipants.findIndex((p) => p.id === m.to);
									if (fromIdx === -1 || toIdx === -1) return null;
									const fromX = layout.participantCenters[fromIdx];
									const toX = layout.participantCenters[toIdx];
									const y = layout.messageY[i] - headerHeight;
									const isReturn = m.kind === "return";
									const isAsync = m.kind === "async";
									const isHovered = hoveredMsgIndex === i;
									const shouldShowLabel = Boolean(m.label) && (cfg.showLabelsMode === "always" || isHovered);
									const isHighlighted = !!m.highlightLabel;

									if (fromIdx === toIdx) {
										const loopWidth = 40;
										const loopHeight = 24;
										const path = `M ${fromX} ${y} h ${loopWidth} v ${loopHeight} h ${-loopWidth}`;
										const labelX = fromX + loopWidth + 4;
										const labelY = y + 12;
										const labelWidth = m.label ? m.label.length * 7 + 20 : 0;
										return (
											<g
												key={`msg-${i}`}
												color={participantColors[fromIdx]}
												onMouseEnter={() => setHoveredMsgIndex(i)}
												onMouseLeave={() => setHoveredMsgIndex(null)}
												style={{ cursor: m.label ? "pointer" : "default" }}
											>
												<path
													d={path}
													fill="none"
													stroke="transparent"
													strokeWidth={12}
													pointerEvents="stroke"
												/>
												<path
													d={path}
													fill="none"
													stroke="currentColor"
													strokeWidth={isHovered ? 2 : 1.5}
													strokeDasharray={isReturn ? "6 6" : undefined}
													markerEnd={isReturn ? "url(#arrow-open)" : "url(#arrow-solid)"}
												/>
												{shouldShowLabel ? (
													<g>
														{m.label ? (
															<rect
																x={labelX - labelWidth / 2}
																y={labelY - 15}
																rx={8}
																ry={8}
																width={labelWidth}
																height={22}
																fill="#ffffff"
																opacity={0.96}
																stroke={isHighlighted ? participantColors[fromIdx] : "#e5e7eb"}
																strokeWidth={isHighlighted ? 1.6 : 1}
																filter={isHighlighted ? "url(#label-blur)" : undefined}
															/>
														) : null}
														<text
															x={labelX}
															y={labelY}
															fontSize={13}
															textAnchor="middle"
															fill="#000000"
															fontWeight={700}
															style={{ cursor: "pointer" }}
															onClick={(evt) =>
															handleLabelClick(evt, {
																title: m.label ?? "",
																	participants: [visibleParticipants[fromIdx].name],
																	content: m.popup,
																	events: m.events,
																	rawMessage: m
																})
															}
														>
															{m.label}
														</text>
													</g>
												) : null}
											</g>
										);
									}

									const leftX = Math.min(fromX, toX);
									const rightX = Math.max(fromX, toX);
									const dir = toX >= fromX ? 1 : -1;
									const labelX = leftX + (rightX - leftX) / 2;
									const labelWidth = m.label ? m.label.length * 7 + 20 : 0;

									return (
										<g
											key={`msg-${i}`}
											color={participantColors[fromIdx]}
											onMouseEnter={() => setHoveredMsgIndex(i)}
											onMouseLeave={() => setHoveredMsgIndex(null)}
											style={{ cursor: m.label ? "pointer" : "default" }}
										>
											<line
												x1={fromX}
												y1={y}
												x2={toX}
												y2={y}
												stroke="transparent"
												strokeWidth={12}
												pointerEvents="stroke"
											/>
											<line
												x1={fromX}
												y1={y}
												x2={toX}
												y2={y}
												stroke="currentColor"
												strokeWidth={isHovered ? 2 : 1.5}
												strokeDasharray={isReturn ? "6 6" : isAsync ? "4 4" : undefined}
												markerEnd={isReturn ? "url(#arrow-open)" : "url(#arrow-solid)"}
											/>
											{shouldShowLabel ? (
												<g>
													{m.label ? (
														<rect
															x={labelX - labelWidth / 2}
															y={y - 6 - 15}
															rx={8}
															ry={8}
															width={labelWidth}
															height={22}
															fill="#ffffff"
															opacity={0.96}
															stroke={isHighlighted ? participantColors[fromIdx] : "#e5e7eb"}
															strokeWidth={isHighlighted ? 1.6 : 1}
															filter={isHighlighted ? "url(#label-blur)" : undefined}
														/>
													) : null}
													<text
														x={labelX}
														y={y - 6}
														fontSize={13}
														textAnchor="middle"
														fill="#000000"
														fontWeight={700}
														style={{ cursor: "pointer" }}
														onClick={(evt) =>
															handleLabelClick(evt, {
																title: m.label ?? "",
																participants: [visibleParticipants[fromIdx].name, visibleParticipants[toIdx].name],
																content: m.popup,
																events: m.events,
																rawMessage: m
															})
														}
													>
														{m.label}
													</text>
												</g>
											) : null}
											<circle cx={fromX} cy={y} r={2} fill="currentColor" opacity={0.5} />
											<circle cx={toX} cy={y} r={2} fill="currentColor" opacity={0.5} />
											<title>
												{visibleParticipants[fromIdx].name} → {visibleParticipants[toIdx].name}
												{m.label ? `: ${m.label}` : ""}
											</title>
											<desc>{dir > 0 ? "left to right" : "right to left"}</desc>
										</g>
									);
								})}
							</svg>
						</div>
						<div className={styles.footer} style={{ position: "sticky", bottom: 0, zIndex: 10 }}>
							<svg
								role="img"
								viewBox={`0 0 ${layout.width} ${headerHeight}`}
								width={width ?? "100%"}
								height={headerHeight}
								preserveAspectRatio="xMinYMin meet"
								style={{ display: "block", color: "currentColor", fontFamily: cfg.fontFamily }}
							>
								{renderParticipantBar()}
								{participants.map((p, i) => {
									const cx = layout.participantCenters[i];
									const accent = participantColors[i];
									return (
										<line
											key={`footer-connector-${p.id}`}
											x1={cx}
											y1={0}
											x2={cx}
											y2={cfg.vMargin}
											stroke={accent}
											strokeDasharray="6 6"
										/>
									);
								})}
							</svg>
						</div>
					</div>
				</div>
			</div>
			{popup ? (
				<div
					className={styles.popup}
					style={{
						top: popup.position.y,
						left: popup.position.x
					}}
					onClick={(evt) => {
						evt.stopPropagation();
					}}
				>
					<button className={styles.popupClose} type="button" onClick={closePopup} aria-label="Close">
						×
					</button>
					<div className={styles.popupTitle}>{popup.title || popup.content?.message || "Untitled label"}</div>
					<div className={styles.popupMessage}>{popup.content?.message ?? popup.title ?? "No details provided."}</div>
					<div className={styles.popupMeta}>
						<strong>Participants:</strong> {popup.participants.join(" → ")}
					</div>
					{popup.content
						? Object.entries(popup.content)
								.filter(([key]) => key !== "message")
								.map(([key, value]) => (
									<div key={key} className={styles.popupExtra}>
										<span className={styles.popupExtraKey}>{key}:</span> <span>{value}</span>
									</div>
								))
						: null}
					{(() => {
						const effectiveEvents: SequenceMessageEvent[] =
							popup.events && popup.events.length > 0
								? popup.events
								: popup.rawMessage
								? [
										{
											id: "full-message",
											label: "Full message payload",
											payload: popup.rawMessage
										}
								  ]
								: [];

						if (effectiveEvents.length === 0) return null;
						return (
						<div className={styles.popupEvents}>
							<div className={styles.popupEventsTitle}>Events</div>
							{effectiveEvents.map((ev) => {
								const isOpen = popup.expandedEventId === ev.id;
								return (
									<div key={ev.id} className={styles.popupEventItem}>
										<div className={styles.popupEventHeader}>
											<div className={styles.popupEventLabel}>{ev.label ?? ev.id}</div>
											<button
												type="button"
												className={styles.popupEventToggle}
												onClick={() =>
													setPopup((prev) =>
														prev
															? {
																	...prev,
																	expandedEventId: prev.expandedEventId === ev.id ? null : ev.id
															  }
															: prev
													)
												}
											>
												{isOpen ? "Hide JSON" : "View JSON"}
											</button>
										</div>
										{isOpen ? (
											<div className={styles.popupEventBody}>
												<pre className={styles.popupEventJson}>
													{JSON.stringify(ev.payload, null, 2)}
												</pre>
											</div>
										) : null}
									</div>
								);
							})}
						</div>
						);
					})()}
				</div>
			) : null}
		</div>
	);
}

export default SequenceDiagram;


