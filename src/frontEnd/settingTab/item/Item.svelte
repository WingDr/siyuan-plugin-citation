<!--
 Copyright (C) 2023 Zuoqiu Yingyi
 
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as
 published by the Free Software Foundation, either version 3 of the
 License, or (at your option) any later version.
 
 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.
 
 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
-->

<!--
    常规设置项(行级)/大型设置项(块级)
    REF: https://github.com/siyuan-note/plugin-sample-vite-svelte/blob/main/src/libs/setting-item.svelte
-->

<script lang="ts">
    //Optional
    interface Props {
        title?: string,
        text?: string,
        block?: boolean,
        input?: any,
        titleSlot?:any,
        textSlot?:any
    }
    let {title, text, block = false, input, titleSlot, textSlot}:Props = $props();
    // export let title: string = ""; // Displaying Setting Title
    // export let text: string = ""; // Displaying Setting Text
    // export let block: boolean = false; // Using Block Style
</script>

<label class="fn__flex b3-label">
    <div
        class="fn__flex-1"
        class:visible={block}
    >
        {@render titleSlot?.()}
        <div>{@html title}</div>
        <div class="b3-label__text">
            {@render textSlot?.()}
            <div>{@html text}</div>
        </div>

        {#if block}
            <div class="fn__hr" ></div>
            {@render input?.()}
        {/if}
    </div>

    {#if !block}
        <span class="fn__space" ></span>
        {@render input?.()}
    {/if}
</label>

<style>
    .visible {
        overflow: visible;
    }
</style>
