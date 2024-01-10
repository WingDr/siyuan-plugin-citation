const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const {EsbuildPlugin} = require("esbuild-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");
const sveltePreprocess = require("svelte-preprocess");

const pluginDir = "D:/Documents/SiYuan/data/plugins/siyuan-plugin-citation/";

module.exports = (env, argv) => {
    const isPro = argv.mode === "production";
    const plugins = [
        new MiniCssExtractPlugin({
            filename: isPro ? "dist/index.css" : "index.css",
        })
    ];
    let entry = {
        "index": "./src/index.ts",
    };
    if (isPro) {
        entry = {
            "dist/index": "./src/index.ts",
        };
        plugins.push(new webpack.BannerPlugin({
            banner: () => {
                return fs.readFileSync("LICENSE").toString();
            },
        }));
        plugins.push(new CopyPlugin({
            patterns: [
                {from: "preview.png", to: "./dist/"},
                {from: "icon.png", to: "./dist/"},
                {from: "citeIcon.ico", to: "./dist/"},
                {from: "README*.md", to: "./dist/"},
                {from: "plugin.json", to: "./dist/"},
                {from: "src/i18n/", to: "./dist/i18n/"},
                {from: "assets/", to: "./dist/assets/"},
                {from: "sample-data/sample.bib", to: "./dist/sample-data/"},
                {from: "sample-data/sample.json", to: "./dist/sample-data/"},
                {from: "zoteroJS/", to: "./dist/zoteroJS/"},
                {from: "./dist/", to: pluginDir, force: true}
            ],
        }));
        plugins.push(new ZipPlugin({
            filename: "package.zip",
            algorithm: "gzip",
            include: [/dist/],
            pathMapper: (assetPath) => {
                return assetPath.replace("dist/", "");
            },
        }));
    } else {
        
        plugins.push(new CopyPlugin({
            patterns: [
                {from: "src/i18n/", to: "./i18n/"},
                {from: "index.css", to: pluginDir, force: true},
                {from: "index.js", to: pluginDir, force: true},
                {from: "preview.png", to: pluginDir, force: true},
                {from: "icon.png", to: pluginDir, force: true},
                {from: "citeIcon.ico", to: pluginDir, force: true},
                {from: "README*.md", to: pluginDir, force: true},
                {from: "plugin.json", to: pluginDir, force: true},
                {from: "src/i18n/", to: path.resolve(pluginDir, "./i18n/"), force: true},
                {from: "assets/", to: path.resolve(pluginDir, "./assets/"), force: true},
                {from: "sample-data/sample.bib", to: path.resolve(pluginDir, "./sample-data/"), force: true},
                {from: "sample-data/sample.json", to: path.resolve(pluginDir, "./sample-data/"), force: true},
                {from: "zoteroJS/", to: path.resolve(pluginDir, "./zoteroJS/"), force: true}
            ]
        }));
    }
    return {
        mode: argv.mode || "development",
        watch: !isPro,
        devtool: isPro ? false : "eval",
        output: {
            filename: "[name].js",
            path: path.resolve(__dirname),
            libraryTarget: "commonjs2",
            library: {
                type: "commonjs2",
            },
        },
        externals: {
            siyuan: "siyuan",
        },
        entry,
        optimization: {
            minimize: true,
            minimizer: [
                new EsbuildPlugin(),
            ],
        },
        resolve: {
            extensions: [".ts", ".scss", ".js", ".json", ".mjs", ".svelte"],
        },
        module: {
            rules: [
                {
                    test: /\.ts(x?)$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [
                        {
                            loader: "esbuild-loader",
                            options: {
                                target: "es6",
                            }
                        },
                    ],
                },
                {
                    test: /\.scss$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: "css-loader", // translates CSS into CommonJS
                        },
                        {
                            loader: "sass-loader", // compiles Sass to CSS
                        },
                    ],
                },
                {
                    test: /\.(html|svelte)$/,
                    use: {
                        loader: "svelte-loader",
                        options: {
                            preprocess: sveltePreprocess()
                        }
                    }
                },
                {
                    // required to prevent errors from Svelte on Webpack 5+, omit on Webpack 4
                    test: /node_modules\/svelte\/.*\.mjs$/,
                    resolve: {
                        fullySpecified: false
                    }
                }
            ],
        },
        plugins,
    };
};
