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
    /**
     * @typedef {Object} Props
     * @property {string} [minWidth]
     * @property {string} [marginRight]
     * @property {boolean} [isCard]
     * @property {import('svelte').Snippet} [icon]
     * @property {import('svelte').Snippet} [title]
     * @property {import('svelte').Snippet} [input]
     */

    /** @type {Props} */
    let {
        minWidth = "24em",
        marginRight = "2em",
        isCard = true,
        icon,
        title,
        input
    } = $props();
</script>

<label
    style="min-width: {minWidth}; margin-right: {marginRight};"
    class="fn__flex"
    class:card-style={isCard}
>
    {@render icon?.()}

    <span class="fn__space" ></span>

    <div class="fn__flex-1">
        {@render title?.()}
    </div>

    <span class="fn__space" ></span>

    {@render input?.()}
</label>

<style>
    label {
        width: unset;
        margin: 0.5em 0;
    }

    .card-style {
        outline: 1px solid var(--b3-border-color-trans);
        border-radius: 4px;
        min-height: 2em;
    }
</style>
