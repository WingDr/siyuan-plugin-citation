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

<!-- 选项卡组 -->

<script lang="ts">
    import type { ComponentEvents } from "svelte";
    import Tab from "./Tab.svelte";
    import Svg from "./../../misc/Svg.svelte";
    import { type ITab } from "./../tab";

    interface Props {
        tabs: ITab[];
        focus: string | number;
        children?: import('svelte').Snippet<[any]>;
    }

    let { tabs, focus = $bindable(), children }: Props = $props();

    function changed(e: ComponentEvents<Tab>["changed"]) {
        focus = e.detail.key;
    }
</script>

<div
    class="fn__flex-column"
    style="height: 100%"
>
    <!-- 选项卡页签栏 -->
    <div class="layout-tab-bar fn__flex">
        {#each tabs as tab (tab.key)}
            <!-- [事件 / 事件转发 • Svelte 教程 | Svelte 中文网](https://www.svelte.cn/tutorial/event-forwarding) -->
            <Tab
                on:changed={changed}
                key={tab.key}
                name={tab.name}
                focus={tab.key === focus}
            >
                {#snippet icon()}
                                <span >
                        {#if tab.icon.startsWith("#")}
                            <Svg icon={tab.icon} />
                        {:else}
                            {@html tab.icon}
                        {/if}
                    </span>
                            {/snippet}
                {#snippet text()}
                                <span >
                        {@html tab.text}
                    </span>
                            {/snippet}
            </Tab>
        {/each}
    </div>

    <!-- 选项卡内容栏 -->
    <!-- [Svelte API 中文文档 | Svelte 中文网](https://www.svelte.cn/docs#slot_let) -->
    <div class="fn__flex-1">
        {#if children}{@render children({ focus, })}{:else}Container{/if}
    </div>
</div>
