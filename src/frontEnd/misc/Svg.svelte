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

<script lang="ts">
    interface Props {
        icon?: string;
        id?: string;
        className?: string;
        style?: string;
    }

    let {
        icon,
        id = "",
        className = "",
        style = ""
    }: Props = $props();
</script>

<svg
    {style}
    data-id={id}
    class:popover__block={id}
    class={className}
>
    <use xlink:href={icon} />
</svg>
