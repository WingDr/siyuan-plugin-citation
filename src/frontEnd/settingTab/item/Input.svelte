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

<!-- 设置项输入组件 -->

<script lang="ts">
    import { createEventDispatcher } from "svelte";

    import { ItemType, type ILimits, type IOptions } from "./item";
    import type { IInputEvent } from "./../event";

    export let type: ItemType; // Setting Type
    export let settingKey: string;
    export let settingValue: any;

    export let disabled: boolean = false; // Disable Input
    export let block: boolean = false; // Using Block Style
    export let normal: boolean = true; // Normal Size
    export let placeholder: string = ""; // Use it if type is text/number/textarea
    export let options: IOptions = []; // Use it if type is select
    export let limits: ILimits = { min: 0, max: 100, step: 1 }; // Use it if type is number/slider
    export let height: number = 0; // Use it if type is textarea
    export let rows: number = 0;

    const dispatch = createEventDispatcher<IInputEvent>();

    function clicked(event: MouseEvent) {
        dispatch("clicked", { event });
    }

    function changed(event: Event) {
        dispatch("changed", { key: settingKey, value: settingValue, event });
    }
</script>

{#if type === ItemType.checkbox}
    <!-- Checkbox -->
    <input
        {disabled}
        class="b3-switch"
        class:fn__block={block}
        class:fn__flex-center={!block}
        type="checkbox"
        bind:checked={settingValue}
        on:change={changed}
    />
{:else if type === ItemType.text}
    <!-- Text Input -->
    <input
        {disabled}
        class="b3-text-field"
        class:fn__block={block}
        class:fn__size200={!block && normal}
        class:fn__flex-center={!block}
        {placeholder}
        bind:value={settingValue}
        on:change={changed}
    />
{:else if type === ItemType.number}
    <!-- Number Input -->
    <input
        {disabled}
        class="b3-text-field"
        class:fn__block={block}
        class:fn__size200={!block && normal}
        class:fn__flex-center={!block}
        type="number"
        {placeholder}
        min={limits.min}
        max={limits.max}
        step={limits.step}
        bind:value={settingValue}
        on:change={changed}
    />
{:else if type === ItemType.slider}
    <!-- Slider -->
    <input
        {disabled}
        class="b3-slider"
        class:fn__block={block}
        class:fn__size200={!block && normal}
        type="range"
        min={limits.min}
        max={limits.max}
        step={limits.step}
        bind:value={settingValue}
        on:change={changed}
    />
{:else if type === ItemType.button}
    <!-- Button Input -->
    <button
        {disabled}
        class="b3-button b3-button--outline"
        class:fn__block={block}
        class:fn__size200={!block && normal}
        class:fn__flex-center={!block}
        on:click={clicked}
    >
        {settingValue}
    </button>
{:else if type === ItemType.select}
    <!-- Dropdown select -->
    <select
        {disabled}
        class="b3-select"
        class:fn__block={block}
        class:fn__size200={!block && normal}
        class:fn__flex-center={!block}
        bind:value={settingValue}
        on:change={changed}
    >
        {#each options as option (option.key)}
            <option value={option.key}>{option.text}</option>
        {/each}
    </select>
{:else if type === ItemType.textarea}
    <!-- Text Area -->
    <textarea
        {disabled}
        class="b3-text-field"
        class:fn__block={block}
        class:fn__size200={!block && normal}
        style:height={height > 0 ? `${height}px` : undefined}
        {placeholder}
        style:resize={block ? "vertical": "auto"}
        rows={rows > 0 ? rows : undefined}
        bind:value={settingValue}
        on:change={changed}
    />
{/if}

<style>
    .fn__block {
        &.b3-switch {
            overflow: visible;
            padding-left: 1em;
        }

        &.b3-slider {
            padding: 0;
        }
    }
</style>
