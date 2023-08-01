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

<!-- 快捷键 -->

<script lang="ts">
    import { createEventDispatcher, type ComponentEvents } from "svelte";

    import Group from "./../item/Group.svelte";
    import MiniItem from "./../item/MiniItem.svelte";
    import Input from "./../item/Input.svelte";
    import Svg from "./../../misc/Svg.svelte";

    import { ItemType } from "./../item/item";
    
    import { type IMouseStatus, MouseButton, MouseEvent } from "../../../utils/shortcut";
    import type { IShortcutEvent } from "./../event";

    export let title: string; // 标题
    export let shortcut: IMouseStatus; // 快捷键

    /* 最小宽度 */
    export let minWidth = undefined;
    export let marginRight = undefined;

    /* 是否显示 */
    export let displayCtrlKey = true;
    export let displayShiftKey = true;
    export let displayAltKey = true;
    export let displayMetaKey = true;
    export let displayMouseButton = true;
    export let displayMouseEvent = true;

    /* 是否禁用 */
    export let disabledCtrlKey = false;
    export let disabledShiftKey = false;
    export let disabledAltKey = false;
    export let disabledMetaKey = false;
    export let disabledMouseButton = false;
    export let disabledMouseEvent = false;

    /* 显示内容 */
    export let mouseButtonTitle = "Mouse Button";
    export let mouseEventTitle = "Mouse Event";
    export let mouseButtonOptions = [
        { key: MouseButton.Left, text: "Left" },
        { key: MouseButton.Middle, text: "Middle" },
        { key: MouseButton.Right, text: "Right" },
        { key: MouseButton.Back, text: "Back" },
        { key: MouseButton.Forward, text: "Forward" },
    ];
    export let mouseEventOptions = [
        { key: MouseEvent.click, text: MouseEvent.click },
        { key: MouseEvent.dblclick, text: MouseEvent.dblclick },
        { key: MouseEvent.mousedown, text: MouseEvent.mousedown },
        { key: MouseEvent.mouseup, text: MouseEvent.mouseup },
        { key: MouseEvent.mouseenter, text: MouseEvent.mouseenter },
        { key: MouseEvent.mouseleave, text: MouseEvent.mouseleave },
        { key: MouseEvent.mousewheel, text: MouseEvent.mousewheel },
        { key: MouseEvent.mouseover, text: MouseEvent.mouseover },
        { key: MouseEvent.mousemove, text: MouseEvent.mousemove },
        { key: MouseEvent.mouseout, text: MouseEvent.mouseout },
    ];

    const dispatch = createEventDispatcher<IShortcutEvent>();
    function changed(e: ComponentEvents<Input>["changed"]) {
        if (shortcut.hasOwnProperty(e.detail.key)) {
            shortcut[e.detail.key] = e.detail.value;
        }
        dispatch("changed", { shortcut });
    }
</script>

<Group {title}>
    {#if displayCtrlKey}
        <MiniItem
            {minWidth}
            {marginRight}
        >
            <Svg
                icon="#iconKeymap"
                className="svg"
            />
            <kbd slot="title">Ctrl</kbd>
            <Input
                slot="input"
                normal={false}
                disabled={disabledCtrlKey}
                type={ItemType.checkbox}
                settingKey="ctrlKey"
                settingValue={shortcut.ctrlKey}
                on:changed={changed}
            />
        </MiniItem>
    {/if}
    {#if displayShiftKey}
        <MiniItem
            {minWidth}
            {marginRight}
        >
            <Svg
                icon="#iconKeymap"
                className="svg"
            />
            <kbd slot="title">Shift</kbd>
            <Input
                slot="input"
                normal={false}
                disabled={disabledShiftKey}
                type={ItemType.checkbox}
                settingKey="shiftKey"
                settingValue={shortcut.shiftKey}
                on:changed={changed}
            />
        </MiniItem>
    {/if}
    {#if displayAltKey}
        <MiniItem
            {minWidth}
            {marginRight}
        >
            <Svg
                icon="#iconKeymap"
                className="svg"
            />
            <kbd slot="title">Alt</kbd>
            <Input
                slot="input"
                normal={false}
                disabled={disabledAltKey}
                type={ItemType.checkbox}
                settingKey="altKey"
                settingValue={shortcut.altKey}
                on:changed={changed}
            />
        </MiniItem>
    {/if}
    {#if displayMetaKey}
        <MiniItem
            {minWidth}
            {marginRight}
        >
            <Svg
                icon="#iconKeymap"
                className="svg"
            />
            <kbd slot="title">Meta</kbd>
            <Input
                slot="input"
                normal={false}
                disabled={disabledMetaKey}
                type={ItemType.checkbox}
                settingKey="metaKey"
                settingValue={shortcut.metaKey}
                on:changed={changed}
            />
        </MiniItem>
    {/if}
    {#if displayMouseButton}
        <MiniItem
            {minWidth}
            {marginRight}
        >
            <Svg
                icon="#iconSelectText"
                className="svg"
            />
            <span slot="title">{mouseButtonTitle}</span>
            <Input
                slot="input"
                normal={false}
                disabled={disabledMouseButton}
                type={ItemType.select}
                settingKey="button"
                settingValue={shortcut.button}
                options={mouseButtonOptions}
                on:changed={changed}
            />
        </MiniItem>
    {/if}
    {#if displayMouseEvent}
        <MiniItem
            {minWidth}
            {marginRight}
        >
            <Svg
                icon="#iconSelectText"
                className="svg"
            />
            <span slot="title">{mouseEventTitle}</span>
            <Input
                slot="input"
                normal={false}
                disabled={disabledMouseEvent}
                type={ItemType.select}
                settingKey="type"
                settingValue={shortcut.type}
                options={mouseEventOptions}
                on:changed={changed}
            />
        </MiniItem>
    {/if}
</Group>
