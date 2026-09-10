const SHORT_ANIMATION_DURATION_SECONDS = 0.1;

function getAnimationPreviewTimeline( duration, currentTime ) {

	const safeDuration = Number.isFinite( duration ) && duration > 0 ? duration : 0;
	const safeCurrentTime = Math.max( 0, Math.min( Number.isFinite( currentTime ) ? currentTime : 0, safeDuration ) );
	const isShort = safeDuration > 0 && safeDuration <= SHORT_ANIMATION_DURATION_SECONDS;

	return {
		isShort,
		playable: safeDuration > 0,
		max: safeDuration,
		value: isShort ? safeDuration : safeCurrentTime,
		disabled: safeDuration <= 0 || isShort
	};

}

export { SHORT_ANIMATION_DURATION_SECONDS, getAnimationPreviewTimeline };
