<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { type SearchRes, type Match } from "./searchDialog";
    import { isDev } from "../../utils/constants";

    let resList: SearchRes[] = [];
    let selector: number = 0;
    let pattern: string = "";
    export let onSelection: (keys: string[]) => void;
    export let search: (pattern: string) => any;

    let highlightedRes: {key: string, item: any, title: string, year: string, authorString: string}[] = [];
    export let selectedList: {key: string, author: string, year: string}[] = [];

    const dispatcher = createEventDispatcher();

    function matchHighlight(match: Match) {
        // if (isDev) this.logger.info("搜索匹配=>", match);
        let contentString = match.value as string;
        const indices = (match.indices as number[][]).sort((a,b) => b[0] - a[0]);
        indices.forEach(indice => {
            contentString = contentString.slice(0, indice[0]) + "<mark>" 
                            + contentString.slice(indice[0], indice[1]+1) + "</mark>"
                            + contentString.slice(indice[1]+1);
        });
        const content = contentString.split("\n");
        return {
            title: content[0],
            year: content[1],
            authorString: content[2]
        };
    }

    function inputReaction( ev ) {
        resList = []
        resList = search(pattern) as SearchRes[];
        selector = 0;
        const selectedKeys = selectedList.map(item => item.key);
        highlightedRes = resList.map(res => {
            const highlight = matchHighlight(res.matches[0]);
            return {
                key: res.item.key,
                item: res.item,
                ...highlight
            }
        }).filter(item => {
            return selectedKeys.indexOf(item.key) == -1;
        });
        dispatcher("refresh");
    }

    function clickReaction(ev: MouseEvent) {
        const target = ev.target as HTMLElement;
        const key = target.parentElement.getAttribute("data-search-id");
        onSelection([key]);
        dispatcher("confirm");
    }

    function keyboardReaction(ev: KeyboardEvent) {
        if (ev.key == "ArrowUp") {
            ev.preventDefault();
            changeSelection(false);
        } else if (ev.key == "ArrowDown") {
            ev.preventDefault();
            changeSelection(true);
        } else if (ev.key == "d" && ev.altKey) {
            ev.preventDefault();
            if (selectedList.length) selectedList = selectedList.slice(0, selectedList.length-1);
        } else if (!ev.isComposing && ev.key == "Enter") {
            ev.preventDefault();
            if (pattern) {
                const key = highlightedRes[selector].key;
                selectedList = [...selectedList, {
                    key,
                    author: highlightedRes[selector].item.author[0] ? highlightedRes[selector].item.author[0].family : highlightedRes[selector].item.title,
                    year: highlightedRes[selector].item.year
                }];
                pattern = "";
                highlightedRes = [];
            } else if (selectedList.length) {
                onSelection(selectedList.map(item => item.key));
                dispatcher("confirm");
            } else {
                dispatcher("confirm");
            }
        } else if (ev.key == "Escape") {
            dispatcher("confirm")
        }
    }

    function changeSelection(plus: boolean) {
        if (!plus && selector == 0) {
            selector = resList.length - 1;
        } else if (plus && selector == resList.length - 1) {
            selector = 0;
        } else {
            selector += plus ? 1 : -1;
        }
        dispatcher("select", {selector});
    }

    function deleteTag(ev: MouseEvent) {
        const target = ev.target as HTMLElement;
        const index = eval(target.getAttribute("data-index"));
        selectedList = selectedList.filter(item => item.key != selectedList[index].key);
    }

</script>

<style lang="scss">
    .input-container {
        margin: 4px 8px;
        margin-top: 8px;
    }

    .result-container {
        padding: 4px 8px;
        overflow-y: scroll;
    }

    .search-item {
        display: flex;
        flex-direction: column;
    }

    .tag-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        margin: 0 10px;
        // overflow-x: scroll;
        flex-flow: wrap;
        padding: 2px 0px;

        &__tag {
            display: flex;
            flex-direction: row;
            align-items: center;
            border-radius: 13px;
            background-color: pink;
            padding-left: 10px;
            margin: 2px;

            &__author {
                max-width: 60px;
                white-space: nowrap;
                text-overflow: ellipsis;
                overflow: hidden;
            }

            &__year {
                width: 30px;
                padding: 0 5px;
            }

            &__close {
                border: 0;
                background-color: transparent;
            }
        }
    }
</style>

<div class="b3-form__icon input-container" id="input-container">
    <svg class="b3-form__icon-icon">
        <use xlink:href="#iconSearch"></use>
    </svg>
    <input 
    id="pattern-input"
    type="text" 
    class="b3-text-field fn__block b3-form__icon-input" 
    style="width: 100%" 
    placeholder="Searching literature"
    bind:value={pattern}
    on:keydown={keyboardReaction}
    on:input={inputReaction}>
</div>
<div class="tag-container" id="tag-container">
    {#each selectedList as sItem, sIndex}
        <div class="tag-container__tag">
            <div class="tag-container__tag__author" data-tag-id={sItem.key}>{sItem.author}</div>
            <div class="tag-container__tag__year" data-tag-id={sItem.key}>{sItem.year}</div>
            <button class="tag-container__tag__close" on:click={deleteTag} data-index={sIndex}>&#215;</button>
        </div>
    {/each}
</div>
<div class="search__layout result-container" id="result-container">
    <ul class="fn__flex-1 search__list b3-list b3-list--background">
        <div id="search-list-top"></div>
        {#each highlightedRes as resItem, index}
            <li class="b3-list-item {(index == selector) ? "b3-list-item--focus" : ""}">
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                <div class="search-item" data-type="search-item" data-search-id={resItem.key}
                role="listitem"
                on:click={clickReaction}>
                    <div class="b3-list-item__text" style="font-weight:bold;border-bottom:0.5px solid #CCC"> {@html resItem.title}</div>
                    <div class="b3-list-item__text">{@html resItem.year + "\t | \t" + resItem.authorString}</div>
                </div>
            </li>
        {/each}
    </ul>
</div>