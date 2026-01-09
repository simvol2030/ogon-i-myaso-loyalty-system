<script lang="ts">
	interface Props {
		threshold: number;
		title: string;
		text: string;
		icon: string;
	}

	let { threshold, title, text, icon }: Props = $props();

	// Replace {threshold} placeholder in text
	const displayText = $derived(text.replace('{threshold}', threshold.toLocaleString('ru-RU')));
</script>

<section class="free-delivery-widget">
	<div class="widget-icon">{icon}</div>
	<div class="widget-content">
		<h3 class="widget-title">{title}</h3>
		<p class="widget-text">{displayText}</p>
	</div>
</section>

<style>
	.free-delivery-widget {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 16px;
		padding: 16px;
		background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
		border-radius: 16px;
		box-shadow: 0 2px 8px rgba(251, 191, 36, 0.2);
	}

	/* Dark theme support */
	:global(.dark) .free-delivery-widget {
		background: linear-gradient(135deg, #78350f 0%, #92400e 100%);
	}

	.widget-icon {
		font-size: 32px;
		flex-shrink: 0;
	}

	.widget-content {
		flex: 1;
		min-width: 0;
	}

	.widget-title {
		font-size: 16px;
		font-weight: 700;
		color: #78350f;
		margin: 0 0 4px 0;
		line-height: 1.2;
	}

	:global(.dark) .widget-title {
		color: #fef3c7;
	}

	.widget-text {
		font-size: 13px;
		color: #92400e;
		margin: 0;
		line-height: 1.4;
		opacity: 0.9;
	}

	:global(.dark) .widget-text {
		color: #fde68a;
	}

	@media (max-width: 480px) {
		.free-delivery-widget {
			margin: 12px;
			padding: 14px;
		}

		.widget-icon {
			font-size: 28px;
		}

		.widget-title {
			font-size: 15px;
		}

		.widget-text {
			font-size: 12px;
		}
	}
</style>
