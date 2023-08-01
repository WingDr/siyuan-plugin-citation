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

<!-- 小型设置项(用于设置项组内) -->

<script>
    export let minWidth = "24em";
    export let marginRight = "2em";
</script>

<label
    style="min-width: {minWidth}; margin-right: {marginRight};"
    class="fn__flex"
>
    <slot name="icon" />

    <span class="fn__space" />

    <div class="fn__flex-1">
        <slot name="title" />
    </div>

    <span class="fn__space" />

    <slot name="input" />
</label>

<style>
    label {
        width: unset;
        margin: 0.5em 0;
    }
</style>
