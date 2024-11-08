<!--
    常规设置项(行级)/大型设置项(块级)
    REF: https://github.com/siyuan-note/plugin-sample-vite-svelte/blob/main/src/libs/setting-item.svelte
-->

<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { ItemType, type ILimits, type IOptions } from "./item";
    import Svg from "./../../misc/Svg.svelte";
    import type { IInputEvent } from "./../event";

    //Optional
    export let title: string = ""; // Displaying Setting Title
    export let text: string = ""; // Displaying Setting Text
    export let icon: string = "";

    const dispatch = createEventDispatcher<IInputEvent>();
    function clicked(event: MouseEvent) {
        dispatch("clicked", { event });
    }
</script>

<label class="fn__flex b3-label">
    <div
        class="fn__flex-1"
    >
        <slot name="title">{@html title}</slot>
        <div class="b3-label__text">
            <slot name="text">{@html text}</slot>
        </div>
    </div>
    <button
        class="b3-tooltips b3-tooltips_nw block__icon block__icon--show"
        on:click={clicked}
    >
        <Svg
            icon={icon}
            className="b3-list-item__graphic"
        />
    </button>
</label>