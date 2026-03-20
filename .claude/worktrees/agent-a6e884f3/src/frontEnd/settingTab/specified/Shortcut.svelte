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

    interface Props {
        title: string; // 标题
        shortcut: IMouseStatus; // 快捷键
        /* 最小宽度 */
        minWidth?: any;
        marginRight?: any;
        /* 是否显示 */
        displayCtrlKey?: boolean;
        displayShiftKey?: boolean;
        displayAltKey?: boolean;
        displayMetaKey?: boolean;
        displayMouseButton?: boolean;
        displayMouseEvent?: boolean;
        /* 是否禁用 */
        disabledCtrlKey?: boolean;
        disabledShiftKey?: boolean;
        disabledAltKey?: boolean;
        disabledMetaKey?: boolean;
        disabledMouseButton?: boolean;
        disabledMouseEvent?: boolean;
        /* 显示内容 */
        mouseButtonTitle?: string;
        mouseEventTitle?: string;
        mouseButtonOptions?: any;
        mouseEventOptions?: any;
    }

    let {
        title,
        shortcut = $bindable(),
        minWidth = undefined,
        marginRight = undefined,
        displayCtrlKey = true,
        displayShiftKey = true,
        displayAltKey = true,
        displayMetaKey = true,
        displayMouseButton = true,
        displayMouseEvent = true,
        disabledCtrlKey = false,
        disabledShiftKey = false,
        disabledAltKey = false,
        disabledMetaKey = false,
        disabledMouseButton = false,
        disabledMouseEvent = false,
        mouseButtonTitle = "Mouse Button",
        mouseEventTitle = "Mouse Event",
        mouseButtonOptions = [
        { key: MouseButton.Left, text: "Left" },
        { key: MouseButton.Middle, text: "Middle" },
        { key: MouseButton.Right, text: "Right" },
        { key: MouseButton.Back, text: "Back" },
        { key: MouseButton.Forward, text: "Forward" },
    ],
        mouseEventOptions = [
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
    ]
    }: Props = $props();

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
            {#snippet title()}
                        <kbd >Ctrl</kbd>
                    {/snippet}
            {#snippet input()}
                        <Input
                    
                    normal={false}
                    disabled={disabledCtrlKey}
                    type={ItemType.checkbox}
                    settingKey="ctrlKey"
                    settingValue={shortcut.ctrlKey}
                    on:changed={changed}
                />
                    {/snippet}
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
            {#snippet title()}
                        <kbd >Shift</kbd>
                    {/snippet}
            {#snippet input()}
                        <Input
                    
                    normal={false}
                    disabled={disabledShiftKey}
                    type={ItemType.checkbox}
                    settingKey="shiftKey"
                    settingValue={shortcut.shiftKey}
                    on:changed={changed}
                />
                    {/snippet}
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
            {#snippet title()}
                        <kbd >Alt</kbd>
                    {/snippet}
            {#snippet input()}
                        <Input
                    
                    normal={false}
                    disabled={disabledAltKey}
                    type={ItemType.checkbox}
                    settingKey="altKey"
                    settingValue={shortcut.altKey}
                    on:changed={changed}
                />
                    {/snippet}
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
            {#snippet title()}
                        <kbd >Meta</kbd>
                    {/snippet}
            {#snippet input()}
                        <Input
                    
                    normal={false}
                    disabled={disabledMetaKey}
                    type={ItemType.checkbox}
                    settingKey="metaKey"
                    settingValue={shortcut.metaKey}
                    on:changed={changed}
                />
                    {/snippet}
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
            {#snippet title()}
                        <span >{mouseButtonTitle}</span>
                    {/snippet}
            {#snippet input()}
                        <Input
                    
                    normal={false}
                    disabled={disabledMouseButton}
                    type={ItemType.select}
                    settingKey="button"
                    settingValue={shortcut.button}
                    options={mouseButtonOptions}
                    on:changed={changed}
                />
                    {/snippet}
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
            {#snippet title()}
                        <span >{mouseEventTitle}</span>
                    {/snippet}
            {#snippet input()}
                        <Input
                    
                    normal={false}
                    disabled={disabledMouseEvent}
                    type={ItemType.select}
                    settingKey="type"
                    settingValue={shortcut.type}
                    options={mouseEventOptions}
                    on:changed={changed}
                />
                    {/snippet}
        </MiniItem>
    {/if}
</Group>
