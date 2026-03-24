const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const {EsbuildPlugin} = require("esbuild-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");
const sveltePreprocess = require("svelte-preprocess");

module.exports = (env, argv) => {
    // 使用环境变量或默认到当前目录，避免硬编码路径
    const targetDir = process.env.SIYUAN_PLUGIN_DIR || path.resolve(__dirname);
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
                {from: "scripts/", to: "./dist/scripts/"}
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
                {from: "preview.png", to: "./"},
                {from: "icon.png", to: "./"},
                {from: "citeIcon.ico", to: "./"},
                {from: "README*.md", to: "./"},
                {from: "plugin.json", to: "./"},
                {from: "assets/", to: "./assets/"},
                {from: "sample-data/", to: "./sample-data/"},
                {from: "zoteroJS/", to: "./zoteroJS/"},
                {from: "scripts/", to: "./scripts/"}
            ]
        }));
    }
    return {
        mode: argv.mode || "development",
        watch: !isPro,
        devtool: isPro ? false : "eval",
        output: {
            filename: "[name].js",
            // path: path.resolve(__dirname),
            path: targetDir,
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
            extensions: [".ts", ".scss", ".js", ".json", ".mjs", ".svelte"]
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
