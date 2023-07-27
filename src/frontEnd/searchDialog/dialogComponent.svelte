<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { type SearchRes, type Match } from "./searchDialog";

    let resList: SearchRes[] = [];
    let selector: number = 0;
    let pattern: string = "";
    export let onSelection: (keys: string[]) => void;
    export let search: (pattern: string) => any;

    let highlightedRes: {key: string, title: string, year: string, authorString: string}[] = [];

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
        highlightedRes = resList.map(res => {
            const highlight = matchHighlight(res.matches[0]);
            return {
                key: res.item.key,
                ...highlight
            }
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
        } else if (ev.key == "Enter") {
            const key = highlightedRes[selector].key;
            onSelection([key]);
            dispatcher("confirm");
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

</script>

<style>
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
</style>

<div class="input-container fn-block" id="input-container">
    <input 
    id="pattern-input"
    type="text" 
    class="b3-text-field b3-text-field--text fn-block" 
    style="width: 100%" 
    placeholder="Searching literature"
    bind:value={pattern}
    on:keydown={keyboardReaction}
    on:input={inputReaction}>
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