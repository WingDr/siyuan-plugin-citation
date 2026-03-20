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

    interface Props {
        key: TabKey; // 该页签的唯一标识
        name?: string; // 该页签的名称
        focus?: boolean; // 该页签是否聚焦
        icon?: import('svelte').Snippet;
        text?: import('svelte').Snippet;
    }

    let {
        key,
        name = "",
        focus = false,
        icon,
        text
    }: Props = $props();

    const dispatch = createEventDispatcher<ITabEvent>();

    function changed() {
        if (!focus) {
            dispatch("changed", { key });
        }
    }
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    role="button"
    data-type={name}
    onclick={changed}
    class:item--focus={focus}
    class="item item--full"
>
    <!-- [组件子级 / Checking for slot content • Svelte 教程 | Svelte 中文网](https://www.svelte.cn/tutorial/optional-slots) -->
    <span class="fn__flex-1" ></span>
    {#if icon}
        <span class="item__icon">
            {@render icon?.()}
        </span>
    {/if}

    <span class="item__text">
        {#if text}{@render text()}{:else}text{/if}
    </span>

    <span class="fn__flex-1" ></span>
</div>
