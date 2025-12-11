<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { StoryHighlight, StoryItem } from '$lib/api/stories';
	import { recordView, getSessionId } from '$lib/api/stories';

	// Props
	let {
		highlights,
		activeHighlightIndex,
		userId = null,
		onClose,
		onNext,
		onPrev,
		onGoTo
	}: {
		highlights: StoryHighlight[];
		activeHighlightIndex: number;
		userId?: number | null;
		onClose: () => void;
		onNext: () => void;
		onPrev: () => void;
		onGoTo?: (index: number) => void;
	} = $props();

	// State
	let currentItemIndex = $state(0);
	let progress = $state(0);
	let paused = $state(false);
	let videoElement = $state<HTMLVideoElement | null>(null);
	let viewStartTime = $state(Date.now());
	let viewerContainerEl = $state<HTMLElement | null>(null);

	// Audio control - muted by default, persists during session
	let isMuted = $state(true);

	// Check if current item is video
	let isCurrentVideo = $derived(currentItem?.type === 'video');

	// Toggle mute function
	function toggleMute() {
		isMuted = !isMuted;
		triggerHaptic('light');
	}

	// Gesture detection state
	let touchStartX = $state(0);
	let touchStartY = $state(0);
	let touchEndX = $state(0);
	let touchEndY = $state(0);
	let touchStartTime = $state(0);
	let isDragging = $state(false);
	let swipeDirection = $state<'none' | 'left' | 'right' | 'up' | 'down'>('none');
	let isTransitioning = $state(false);

	// Swipe down visual feedback
	let dragOffsetY = $state(0);
	let backdropOpacity = $state(0.95);

	// Gesture detection thresholds
	const TAP_MAX_DISTANCE = 30; // Max distance to consider as tap (px)
	const TAP_MAX_DURATION = 500; // Max duration to consider as tap (ms)
	const SWIPE_THRESHOLD_HORIZONTAL = 50; // Minimum horizontal swipe distance (px)
	const SWIPE_THRESHOLD_VERTICAL = 100; // Minimum vertical swipe distance (px)
	const SWIPE_VELOCITY_MIN = 0.2; // Minimum swipe velocity (px/ms)

	// Tap zones - improved for better UX
	const TAP_ZONE_LEFT = 0.4; // 0-40% = previous
	const TAP_ZONE_RIGHT = 0.6; // 60-100% = next
	// Center 40-60% = pause/resume

	// Video duration tracking (actual duration from video element)
	let actualVideoDuration = $state(0);

	// Computed
	let currentHighlight = $derived(highlights[activeHighlightIndex]);
	let currentItem = $derived(currentHighlight?.items[currentItemIndex]);
	let itemsCount = $derived(currentHighlight?.items.length || 0);

	// For photos: use configured duration; For videos: use actual video duration
	let duration = $derived(
		currentItem?.type === 'video'
			? (actualVideoDuration > 0 ? actualVideoDuration * 1000 : (currentItem.duration || 30) * 1000)
			: (currentItem?.duration || 5) * 1000
	);

	// Edge detection for swipes
	let isFirstHighlight = $derived(activeHighlightIndex === 0);
	let isLastHighlight = $derived(activeHighlightIndex === highlights.length - 1);

	// Progress timer
	let progressInterval: ReturnType<typeof setInterval> | null = null;

	// Haptic feedback for Telegram WebApp
	function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') {
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const webApp = (window as any)?.Telegram?.WebApp;
			if (typeof window !== 'undefined' && webApp?.HapticFeedback) {
				if (type === 'success' || type === 'error') {
					webApp.HapticFeedback.notificationOccurred(type);
				} else {
					webApp.HapticFeedback.impactOccurred(type);
				}
			}
		} catch {
			// Silently fail if haptic not available
		}
	}

	function startProgress() {
		progress = 0;
		viewStartTime = Date.now();
		actualVideoDuration = 0; // Reset for new item

		if (progressInterval) {
			clearInterval(progressInterval);
			progressInterval = null;
		}

		// For videos, progress is tracked via timeupdate event and ended event
		// For photos, use interval timer
		if (currentItem?.type !== 'video') {
			progressInterval = setInterval(() => {
				if (!paused) {
					progress += 50;
					if (progress >= duration) {
						goToNextItem();
					}
				}
			}, 50);
		}
		// For videos: progress updated by handleVideoTimeUpdate,
		// transition by handleVideoEnded
	}

	function stopProgress() {
		if (progressInterval) {
			clearInterval(progressInterval);
			progressInterval = null;
		}
	}

	function goToNextItem() {
		recordCurrentView(true);
		triggerHaptic('light');

		if (currentItemIndex < itemsCount - 1) {
			currentItemIndex++;
			startProgress();
		} else {
			onNext();
		}
	}

	function goToPrevItem() {
		recordCurrentView(false);
		triggerHaptic('light');

		if (progress > duration * 0.2) {
			// Restart current item if past 20%
			startProgress();
		} else if (currentItemIndex > 0) {
			currentItemIndex--;
			startProgress();
		} else {
			onPrev();
			currentItemIndex = 0;
		}
	}

	async function recordCurrentView(completed: boolean) {
		if (!currentItem) return;

		const viewDuration = (Date.now() - viewStartTime) / 1000;

		try {
			await recordView({
				storyItemId: currentItem.id,
				userId,
				sessionId: getSessionId(),
				viewDuration,
				completed
			});
		} catch (err) {
			console.error('Failed to record view:', err);
		}
	}

	async function handleLinkClick() {
		if (!currentItem?.linkUrl) return;

		triggerHaptic('medium');

		try {
			await recordView({
				storyItemId: currentItem.id,
				userId,
				sessionId: getSessionId(),
				viewDuration: (Date.now() - viewStartTime) / 1000,
				completed: false,
				linkClicked: true
			});
		} catch (err) {
			console.error('Failed to record link click:', err);
		}

		window.open(currentItem.linkUrl, '_blank');
	}

	// Gesture detection functions
	function handleGestureStart(e: MouseEvent | TouchEvent) {
		if (isTransitioning) return;

		paused = true; // Pause during interaction
		isDragging = true;
		touchStartTime = Date.now();

		if ('touches' in e) {
			touchStartX = e.touches[0].clientX;
			touchStartY = e.touches[0].clientY;
		} else {
			touchStartX = e.clientX;
			touchStartY = e.clientY;
		}

		touchEndX = touchStartX;
		touchEndY = touchStartY;
		swipeDirection = 'none';
		dragOffsetY = 0;
	}

	function handleGestureMove(e: MouseEvent | TouchEvent) {
		if (!isDragging) return;

		if ('touches' in e) {
			touchEndX = e.touches[0].clientX;
			touchEndY = e.touches[0].clientY;
		} else {
			touchEndX = e.clientX;
			touchEndY = e.clientY;
		}

		const deltaX = touchEndX - touchStartX;
		const deltaY = touchEndY - touchStartY;

		// Determine swipe direction
		if (Math.abs(deltaY) > Math.abs(deltaX)) {
			swipeDirection = deltaY < 0 ? 'up' : 'down';
		} else {
			swipeDirection = deltaX < 0 ? 'left' : 'right';
		}

		// Visual feedback for swipe down (close gesture)
		if (swipeDirection === 'down' && deltaY > 0) {
			dragOffsetY = Math.min(deltaY * 0.5, 200); // Max 200px offset
			backdropOpacity = Math.max(0.3, 0.95 - (deltaY / 400)); // Fade backdrop
		}
	}

	function handleGestureEnd(e: MouseEvent | TouchEvent) {
		if (!isDragging) return;

		isDragging = false;
		paused = false; // Resume playback

		const deltaX = touchEndX - touchStartX;
		const deltaY = touchEndY - touchStartY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		const gestureDuration = Date.now() - touchStartTime;
		const velocity = distance / gestureDuration;

		// Reset visual feedback
		dragOffsetY = 0;
		backdropOpacity = 0.95;

		// Determine gesture type
		const isTap = distance < TAP_MAX_DISTANCE && gestureDuration < TAP_MAX_DURATION;
		const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) &&
			Math.abs(deltaX) > SWIPE_THRESHOLD_HORIZONTAL &&
			velocity > SWIPE_VELOCITY_MIN;
		const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX) &&
			deltaY > SWIPE_THRESHOLD_VERTICAL &&
			velocity > SWIPE_VELOCITY_MIN;

		if (isTap) {
			handleTapGesture();
		} else if (isVerticalSwipe && swipeDirection === 'down') {
			handleVerticalSwipe();
		} else if (isHorizontalSwipe) {
			handleHorizontalSwipe(deltaX < 0 ? 'left' : 'right');
		}

		// Reset gesture state
		swipeDirection = 'none';
	}

	// Swipe down to close Stories
	function handleVerticalSwipe() {
		isTransitioning = true;
		swipeDirection = 'down';
		triggerHaptic('medium');

		// Animate and close
		setTimeout(() => {
			onClose();
			isTransitioning = false;
			swipeDirection = 'none';
		}, 250);
	}

	// Swipe left/right to navigate between highlights
	function handleHorizontalSwipe(direction: 'left' | 'right') {
		if (isTransitioning) return;

		if (direction === 'left' && !isLastHighlight) {
			// Swipe left = next highlight
			isTransitioning = true;
			swipeDirection = 'left';
			triggerHaptic('light');

			setTimeout(() => {
				onNext();
				currentItemIndex = 0; // Reset to first item
				isTransitioning = false;
				swipeDirection = 'none';
			}, 250);
		} else if (direction === 'right' && !isFirstHighlight) {
			// Swipe right = previous highlight
			isTransitioning = true;
			swipeDirection = 'right';
			triggerHaptic('light');

			setTimeout(() => {
				onPrev();
				currentItemIndex = 0; // Reset to first item
				isTransitioning = false;
				swipeDirection = 'none';
			}, 250);
		} else {
			// Edge case: bounce animation (first or last highlight)
			isTransitioning = true;
			swipeDirection = direction;
			triggerHaptic('error');

			setTimeout(() => {
				isTransitioning = false;
				swipeDirection = 'none';
			}, 350);
		}
	}

	// Tap gesture handler - uses stored touchEndX for reliable position
	function handleTapGesture() {
		if (!viewerContainerEl) return;

		const rect = viewerContainerEl.getBoundingClientRect();
		const tapPosition = (touchEndX - rect.left) / rect.width;

		if (tapPosition < TAP_ZONE_LEFT) {
			// Left zone - previous item
			goToPrevItem();
		} else if (tapPosition > TAP_ZONE_RIGHT) {
			// Right zone - next item
			goToNextItem();
		} else {
			// Center zone - toggle pause
			paused = !paused;
			triggerHaptic('light');
		}
	}

	// Direct click handlers for navigation hint zones
	function handleLeftZoneClick(e: MouseEvent) {
		e.stopPropagation();
		goToPrevItem();
	}

	function handleRightZoneClick(e: MouseEvent) {
		e.stopPropagation();
		goToNextItem();
	}

	// Handle keyboard navigation
	function handleKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case 'ArrowLeft':
				goToPrevItem();
				break;
			case 'ArrowRight':
				goToNextItem();
				break;
			case 'ArrowUp':
				// Previous highlight
				if (!isFirstHighlight) {
					handleHorizontalSwipe('right');
				}
				break;
			case 'ArrowDown':
				// Next highlight or close if last
				if (!isLastHighlight) {
					handleHorizontalSwipe('left');
				} else {
					onClose();
				}
				break;
			case 'Escape':
				onClose();
				break;
			case ' ':
				paused = !paused;
				e.preventDefault();
				break;
			case 'm':
			case 'M':
				// Toggle mute for video
				if (isCurrentVideo) {
					toggleMute();
				}
				break;
		}
	}

	// Track previous highlight index to detect actual changes
	let prevHighlightIndex = $state(-1);

	// Reset item index when highlight changes
	$effect(() => {
		if (activeHighlightIndex >= 0 && activeHighlightIndex !== prevHighlightIndex) {
			prevHighlightIndex = activeHighlightIndex;
			currentItemIndex = 0;
			startProgress();
		}
	});

	// Handle video playback
	$effect(() => {
		if (videoElement && currentItem?.type === 'video') {
			if (paused) {
				videoElement.pause();
			} else {
				videoElement.play().catch(() => {});
			}
		}
	});

	// Video event handlers
	function handleVideoLoadedMetadata() {
		if (videoElement && isFinite(videoElement.duration)) {
			actualVideoDuration = videoElement.duration;
			// Don't call startProgress() here - it's already called when item changes
			// Just update the duration for progress bar calculation
		}
	}

	function handleVideoTimeUpdate() {
		// Update progress based on actual video playback position
		if (videoElement && videoElement.duration > 0 && !paused) {
			// progress in milliseconds = currentTime in seconds * 1000
			progress = videoElement.currentTime * 1000;
		}
	}

	function handleVideoEnded() {
		// Video finished playing, go to next item
		goToNextItem();
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		stopProgress();
		window.removeEventListener('keydown', handleKeydown);
		recordCurrentView(false);
	});
</script>

<div class="story-viewer">
	<div
		class="viewer-backdrop"
		class:closing={swipeDirection === 'down' && isTransitioning}
		style="opacity: {backdropOpacity}"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		role="button"
		tabindex="-1"
		aria-label="Закрыть истории"
	></div>

	<div
		class="viewer-container"
		class:transitioning={isTransitioning}
		class:swipe-left={swipeDirection === 'left' && isTransitioning}
		class:swipe-right={swipeDirection === 'right' && isTransitioning}
		class:swipe-down={swipeDirection === 'down' && isTransitioning}
		class:bounce-left={swipeDirection === 'left' && isTransitioning && isLastHighlight}
		class:bounce-right={swipeDirection === 'right' && isTransitioning && isFirstHighlight}
		style="transform: translateY({dragOffsetY}px)"
		bind:this={viewerContainerEl}
	>
		<!-- Progress bars -->
		<div class="progress-bars">
			{#each currentHighlight?.items || [] as item, index}
				<div class="progress-bar">
					<div
						class="progress-fill"
						class:completed={index < currentItemIndex}
						class:active={index === currentItemIndex}
						style={index === currentItemIndex ? `width: ${(progress / duration) * 100}%` : ''}
					></div>
				</div>
			{/each}
		</div>

		<!-- Header -->
		<div class="viewer-header">
			<div class="highlight-info">
				<div class="highlight-avatar">
					{#if currentHighlight?.coverImage}
						<img src={currentHighlight.coverImage} alt="" />
					{:else}
						<span>📷</span>
					{/if}
				</div>
				<span class="highlight-title">{currentHighlight?.title}</span>
				{#if paused}
					<span class="paused-indicator">⏸</span>
				{/if}
			</div>
			<div class="header-buttons">
				{#if isCurrentVideo}
					<button class="mute-btn" onclick={toggleMute} aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}>
						{#if isMuted}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M11 5L6 9H2v6h4l5 4V5z" />
								<line x1="23" y1="9" x2="17" y2="15" />
								<line x1="17" y1="9" x2="23" y2="15" />
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M11 5L6 9H2v6h4l5 4V5z" />
								<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
							</svg>
						{/if}
					</button>
				{/if}
				<button class="close-btn" onclick={onClose} aria-label="Закрыть">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Content with gesture handlers -->
		<div
			class="viewer-content"
			role="button"
			tabindex="0"
			onmousedown={handleGestureStart}
			onmousemove={handleGestureMove}
			onmouseup={handleGestureEnd}
			onmouseleave={handleGestureEnd}
			ontouchstart={handleGestureStart}
			ontouchmove={handleGestureMove}
			ontouchend={handleGestureEnd}
			ontouchcancel={handleGestureEnd}
		>
			{#if currentItem}
				{#if currentItem.type === 'photo'}
					<img
						src={currentItem.mediaUrl}
						alt=""
						class="story-media"
						draggable="false"
					/>
				{:else if currentItem.type === 'video'}
					<video
						bind:this={videoElement}
						src={currentItem.mediaUrl}
						class="story-media"
						autoplay
						playsinline
						muted={isMuted}
						loop={false}
						onloadedmetadata={handleVideoLoadedMetadata}
						ontimeupdate={handleVideoTimeUpdate}
						onended={handleVideoEnded}
					>
						<track kind="captions" />
					</video>
				{/if}
			{/if}

			<!-- Pause overlay indicator -->
			{#if paused}
				<div class="pause-overlay">
					<div class="pause-icon">
						<svg viewBox="0 0 24 24" fill="white">
							<path d="M8 5v14l11-7z"/>
						</svg>
					</div>
				</div>
			{/if}
		</div>

		<!-- Link button -->
		{#if currentItem?.linkUrl}
			<div class="link-overlay">
				<button class="link-btn" onclick={handleLinkClick}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M7 17L17 7M17 7H7M17 7v10" />
					</svg>
					{currentItem.linkText || 'Подробнее'}
				</button>
			</div>
		{/if}

		<!-- Navigation hint zones with click handlers -->
		<button
			class="nav-hint left"
			onclick={handleLeftZoneClick}
			aria-label="Предыдущая история"
		></button>
		<button
			class="nav-hint right"
			onclick={handleRightZoneClick}
			aria-label="Следующая история"
		></button>

		<!-- Highlight navigation dots (for multiple highlights) -->
		{#if highlights.length > 1}
			<div class="highlight-nav">
				{#each highlights as h, index}
					<button
						class="highlight-dot"
						class:active={index === activeHighlightIndex}
						onclick={() => onGoTo?.(index)}
						aria-label="Перейти к истории {index + 1}"
					></button>
				{/each}
			</div>
		{/if}

		<!-- Swipe down indicator -->
		<div class="swipe-down-hint">
			<div class="swipe-indicator"></div>
		</div>
	</div>
</div>

<style>
	.story-viewer {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.viewer-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.95);
		transition: opacity 0.25s ease;
	}

	.viewer-backdrop.closing {
		opacity: 0 !important;
	}

	.viewer-container {
		position: relative;
		width: 100%;
		max-width: 420px;
		height: 100%;
		max-height: 100vh;
		display: flex;
		flex-direction: column;
		background: #000;
		transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
	}

	@media (min-width: 768px) {
		.viewer-container {
			height: 90vh;
			max-height: 800px;
			border-radius: 1rem;
			overflow: hidden;
		}
	}

	/* Swipe animations */
	.viewer-container.swipe-left {
		animation: slideOutLeft 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}

	.viewer-container.swipe-right {
		animation: slideOutRight 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}

	.viewer-container.swipe-down {
		animation: slideDown 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}

	/* Bounce animations for edge cases */
	.viewer-container.bounce-left {
		animation: bounceLeft 0.35s cubic-bezier(0.68, -0.55, 0.27, 1.55);
	}

	.viewer-container.bounce-right {
		animation: bounceRight 0.35s cubic-bezier(0.68, -0.55, 0.27, 1.55);
	}

	@keyframes slideOutLeft {
		from {
			transform: translateX(0);
			opacity: 1;
		}
		to {
			transform: translateX(-30%);
			opacity: 0;
		}
	}

	@keyframes slideOutRight {
		from {
			transform: translateX(0);
			opacity: 1;
		}
		to {
			transform: translateX(30%);
			opacity: 0;
		}
	}

	@keyframes slideDown {
		from {
			transform: translateY(0);
			opacity: 1;
		}
		to {
			transform: translateY(100%);
			opacity: 0;
		}
	}

	@keyframes bounceLeft {
		0%, 100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(-20px);
		}
	}

	@keyframes bounceRight {
		0%, 100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(20px);
		}
	}

	/* Disable pointer events during transition */
	.viewer-container.transitioning {
		pointer-events: none;
	}

	/* Progress bars */
	.progress-bars {
		display: flex;
		gap: 4px;
		padding: 8px 12px;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
	}

	.progress-bar {
		flex: 1;
		height: 3px;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: white;
		width: 0;
		transition: width 50ms linear;
	}

	.progress-fill.completed {
		width: 100%;
	}

	/* Header */
	.viewer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 2.5rem 12px 8px;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), transparent);
	}

	.highlight-info {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.highlight-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		overflow: hidden;
		background: #333;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid white;
	}

	.highlight-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.highlight-title {
		color: white;
		font-weight: 600;
		font-size: 0.9375rem;
	}

	.paused-indicator {
		font-size: 0.875rem;
		opacity: 0.7;
	}

	.header-buttons {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.mute-btn {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 0.2s;
	}

	.mute-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.mute-btn svg {
		width: 18px;
		height: 18px;
	}

	.close-btn {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 0.2s;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.close-btn svg {
		width: 20px;
		height: 20px;
	}

	/* Content */
	.viewer-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		cursor: pointer;
		-webkit-user-select: none;
		user-select: none;
		position: relative;
	}

	.story-media {
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
	}

	/* Pause overlay */
	.pause-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.3);
		pointer-events: none;
	}

	.pause-icon {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pause-icon svg {
		width: 32px;
		height: 32px;
		margin-left: 4px; /* Visual centering for play icon */
	}

	/* Link button */
	.link-overlay {
		position: absolute;
		bottom: 60px;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		z-index: 10;
	}

	.link-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 24px;
		background: white;
		border: none;
		border-radius: 2rem;
		color: #111;
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
	}

	.link-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
	}

	.link-btn:active {
		transform: scale(0.98);
	}

	.link-btn svg {
		width: 18px;
		height: 18px;
	}

	/* Navigation hint zones - now clickable buttons */
	.nav-hint {
		position: absolute;
		top: 80px; /* Below header */
		bottom: 80px; /* Above link button */
		width: 40%; /* Expanded from 30% */
		z-index: 5;
		background: transparent;
		border: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.nav-hint:focus {
		outline: none;
	}

	.nav-hint.left {
		left: 0;
	}

	.nav-hint.right {
		right: 0;
	}

	/* Highlight navigation dots */
	.highlight-nav {
		position: absolute;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 6px;
		z-index: 10;
	}

	.highlight-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.4);
		border: none;
		cursor: pointer;
		transition: all 0.2s;
		padding: 0;
	}

	.highlight-dot.active {
		background: white;
		transform: scale(1.2);
	}

	.highlight-dot:hover {
		background: rgba(255, 255, 255, 0.7);
	}

	/* Swipe down hint indicator */
	.swipe-down-hint {
		position: absolute;
		bottom: 8px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 5;
		pointer-events: none;
	}

	.swipe-indicator {
		width: 40px;
		height: 4px;
		background: rgba(255, 255, 255, 0.5);
		border-radius: 2px;
	}
</style>
