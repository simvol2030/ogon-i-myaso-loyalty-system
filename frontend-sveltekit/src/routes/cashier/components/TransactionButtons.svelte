<script lang="ts">
	interface Props {
		onComplete: () => void;
		onCancel: () => void;
	}

	let { onComplete, onCancel }: Props = $props();
</script>

<button class="btn btn-primary mt-3" onclick={onComplete}>
	Провести оплату
</button>

<button class="btn btn-secondary mt-2" onclick={onCancel}>
	Отмена
</button>
