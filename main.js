// ==UserScript==
// @name         batch-save
// @namespace    http://tampermonkey.net/
// @version      0.3.2
// @description  batch save
// @author       deycoesr@gmail.com
// @match        *://pan.baidu.com/disk/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=baidu.com
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  const uKey = "button-g0u198g2ukasd9761yhjkjbsd617872gv78asd";

  setInterval(() => {
    if (!document.getElementById(uKey)) {
      let buttonGroup = document.querySelector(
        ".wp-s-core-pan__header-tool-bar--action > .wp-s-agile-tool-bar > .wp-s-agile-tool-bar__header > .wp-s-agile-tool-bar__h-group > .u-button-group"
      );
      if (!buttonGroup) {
        // 兼容旧版
        buttonGroup = document.querySelector(".tcuLAu");
      }
      if (buttonGroup) {
        appendBtn(buttonGroup);
      }
    }
  }, 200);

  function appendBtn(buttonGroup) {
    let batchSaveBtn = document.createElement("button");
    batchSaveBtn.id = uKey;
    batchSaveBtn.innerText = "批量保存";
    batchSaveBtn.onclick = (e) => batchSave.call(batchSaveBtn, e);

    buttonGroup.append(createDividerElement());
    buttonGroup.append(batchSaveBtn);

    let batchUploadBtn = document.createElement("button");
    batchUploadBtn.innerText = "选择文件夹";
    batchUploadBtn.onclick = function () {
      let batchUploadInput = document.createElement("input");
      batchUploadInput.type = "file";
      batchUploadInput.webkitdirectory = true;
      batchUploadInput.multiple = true;
      batchUploadInput.onchange = (e) => parseFolder.call(batchUploadBtn, e);
      batchUploadInput.click();
    };

    buttonGroup.append(createDividerElement());
    buttonGroup.append(batchUploadBtn);

    buttonGroup.append(createDividerElement());
  }

  function createDividerElement() {
    let pElem = document.createElement("span");
    pElem.innerText = "|";
    return pElem;
  }

  const PATH_SPLIT_REGEX = /[/\\]/,
    URLS_SPLIT_REGEX = /\s/;

  async function parseFolder(e) {
    let files = e?.target?.files;
    if (files) {
      let texts = [];
      for (const file of files) {
        if (file.type === "text/plain") {
          texts.push(await file.text());
        }
      }
      let urls = texts.reduce((left, right) => left + "\n" + right, "");

      await doBatchSave.call(this, urls);
    } else {
      window.alert("未能获得到文件");
    }
  }

  /**
   * 处理 url空格提取码 的情况
   */
  function populateUrls(urls) {
    for (let index = 0; index < urls.length; index++) {
      let url = urls[index];
      if (url.startsWith("http") && url.indexOf("?pwd=") < 0) {
        // 如果是链接并且没有提取码
        // 那么默认提取码是下一个
        let pwd = urls[index + 1];
        if (pwd.startsWith("http")) {
          const errorMsg = "链接 '" + url + "' 无法找到对应的提取码";
          window.alert(errorMsg);
          throw new Error(errorMsg);
        }
        urls[index] = url + "?pwd=" + pwd;
        urls.splice(index + 1, 1);
      }
    }

    for (let url of urls) {
      if (!url.startsWith("http")) {
        const errorMsg = "无效的链接 '" + url + "'";
        window.alert(errorMsg);
        throw new Error(errorMsg);
      }
    }

    // 去掉重复
    return [...new Set(urls)];
  }

  async function doBatchSave(urlsText) {
    let urls = urlsText
      .split(URLS_SPLIT_REGEX)
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    urls = populateUrls(urls);

    if (urls.length === 0) {
      window.alert("未能获得有效的链接");
      return;
    }

    this.innerText = "共获得 " + urls.length + " 个有效链接";
    console.log("batch-save; 有效的 urls = " + urls);

    let targetFolders = prompt(
      "以 '\\' 或 '/' 作为分隔符\n例子: 2023年/8月\\中旬\n默认为根目录\n输入存储路径:"
    );
    if (targetFolders) {
      targetFolders = targetFolders
        .split(PATH_SPLIT_REGEX)
        .map((url) => url.trim())
        .filter((path) => path.length > 0);
    } else {
      targetFolders = [];
    }

    const targetWin = unsafeWindow.open(
      "about:blank",
      "taget",
      "width=1080,height=720"
    );

    for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
      let url = urls[urlIndex];
      this.innerText =
        "正在处理第 " + (urlIndex + 1) + " 个链接，共 " + urls.length + " 个";
      targetWin.location.href = url;

      await waitFound(() => {
        let submitBtn = targetWin.document.getElementById("submitBtn");
        if (submitBtn && submitBtn.innerText === "提取文件") {
          submitBtn.click();
        }

        return targetWin.location.href.startsWith(url);
      });

      const targetDoc = targetWin.document;

      await waitFound(() => targetDoc.readyState === "complete");

      let saveBtnPatten;
      if (targetWin.location.href.indexOf("path=") > 0) {
        // 分享的文件夹 需要点击选择全部

        // 点击选择全部
        const selectAllCheckbox = await waitFound(() =>
          targetDoc.querySelector("li[data-key='server_filename'] > div")
        );
        selectAllCheckbox.click();

        saveBtnPatten =
          "a.g-button[style='display: inline-block;'][title='保存到我的百度网盘']";
      } else {
        // 分享的单个文件 直接保存就行
        saveBtnPatten = "a.g-button.tools-share-save-hb[title='保存到网盘']";
      }

      const saveBtn = await waitFound(() =>
        targetDoc.querySelector(saveBtnPatten)
      );
      saveBtn.click();

      const confirmBtn = await waitFound(() =>
        targetDoc.querySelector("a[title='确定'][node-type='confirm']")
      );

      if (targetFolders.length !== 0) {
        let foundFolderNodes = async () => {
          return await waitFound(() =>
            targetDoc.querySelectorAll(
              "div.file-tree-container > ul.treeview.treeview-content > li > ul > li"
            )
          );
        };

        let folderNodes = await foundFolderNodes();

        let newFolderBtn = targetDoc.querySelector(
          "a.g-button.g-button-large[title='新建文件夹']"
        );

        OUT: for (
          let folderDeep = 0;
          folderDeep < targetFolders.length;
          folderDeep++
        ) {
          const targetFolder = targetFolders[folderDeep],
            currPath =
              "/" +
              targetFolders
                .slice(0, folderDeep + 1)
                .reduce((left, right) => left + "/" + right);
          for (const node of folderNodes) {
            const nodePath = node
              .querySelector("span.treeview-txt")
              .getAttribute("node-path");
            if (nodePath === currPath) {
              // 找到已经存在的路径节点
              // 点击并选择
              node.querySelector("div.treeview-node").click();
              foundFolderNodes = async () => {
                return await waitFound(() => node.querySelectorAll("ul > li"));
              };

              // 如果是最后一层不需要重新查找
              if (folderDeep + 1 >= targetFolders.length) {
                break OUT;
              } else {
                folderNodes = await foundFolderNodes();
                continue OUT;
              }
            }
          }
          // 未能找到路径 需要进行创建
          newFolderBtn.click();

          const createFolderInput = targetDoc.querySelector(
            "span.plus-create-folder > input"
          );
          createFolderInput.value = targetFolder;

          (
            await waitFound(() =>
              targetDoc.querySelector(
                "span.plus-create-folder > span.sure.shareFolderConfirm"
              )
            )
          ).click();

          await waitFound(
            () =>
              !targetDoc.querySelector(
                "span.plus-create-folder > span.sure.shareFolderConfirm"
              )
          );

          // 如果是最后一层 创建之后会自动选中 所以不需要重新查找
          if (folderDeep + 1 >= targetFolders.length) {
            break;
          }

          // 新建的节点不存在子节点
          folderNodes = [];
        }
      }

      confirmBtn.click();

      await waitFound(
        () =>
          targetDoc.querySelector("div.info-section-title")?.innerText ==
          "保存成功"
      );
    }

    targetWin.close();

    unsafeWindow.location.reload();
  }

  async function batchSave() {
    let urlsText = prompt("以 '空格' 或 '换行' 作为间隔符\n输入分享链接:");
    if (!urlsText || urlsText.length === 0) {
      window.alert("输入的分享链接无效");
      return;
    }

    await doBatchSave.call(this, urlsText);
  }

  async function waitFound(conditionFun, maxnum = 300) {
    let count = 0;
    for (;;) {
      let param = await conditionFun.call();
      if (param && param.length !== 0) {
        return param;
      }
      await sleep(200);
      if (++count > maxnum) {
        throw new Error("超出最大等待次数");
      }
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
