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

<!-- 标签页页签 -->
<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import type { TabKey } from "./../tab";
    import type { ITabEvent } from "./../event";

    export let key: TabKey; // 该页签的唯一标识
    export let name: string = ""; // 该页签的名称
    export let focus: boolean = false; // 该页签是否聚焦

    const dispatch = createEventDispatcher<ITabEvent>();

    function changed() {
        if (!focus) {
            dispatch("changed", { key });
        }
    }
</script>

<!-- svelte-ignore a11y-interactive-supports-focus -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
    role="button"
    data-type={name}
    on:click={changed}
    class:item--focus={focus}
    class="item item--full"
>
    <!-- [组件子级 / Checking for slot content • Svelte 教程 | Svelte 中文网](https://www.svelte.cn/tutorial/optional-slots) -->
    <span class="fn__flex-1" />
    {#if $$slots.icon}
        <span class="item__icon">
            <slot name="icon" />
        </span>
    {/if}

    <span class="item__text">
        <slot name="text">text</slot>
    </span>

    <span class="fn__flex-1" />
</div>
