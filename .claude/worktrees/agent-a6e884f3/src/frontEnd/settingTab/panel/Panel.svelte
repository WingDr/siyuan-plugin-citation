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

<!-- 面板容器 -->

<script lang="ts">
    interface Props {
        display?: boolean; // 是否显示该面板
        top?: boolean; // 是否移除保留面板上下边距，目前思源原版样式已经自动移除
        name?: string; // 面板名称
        children?: import('svelte').Snippet;
    }

    let {
        display = true,
        top = false,
        name = "",
        children
    }: Props = $props();
</script>

<div
    data-name={name}
    class:fn__none={!display}
    class:config__tab-container--top={top}
    class="config__tab-container"
>
    {@render children?.()}
</div>
