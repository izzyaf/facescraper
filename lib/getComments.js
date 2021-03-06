const { wait } = require("./utils")

// https://www.facebook.com/toyotavnsports/posts/669934053429917
// https://www.facebook.com/toyotavnsports/videos/2391237544492248
module.exports = async (browser, url) => {
  const page = await browser.newPage()
  await page.goto(url)

  try {
    // remove right column that may contains comment section of other posts
    await page.evaluate(() => {
      const rightCol = document.querySelector("#rightCol")

      if (rightCol) {
        // just remove the first child node so layout won't break
        rightCol.removeChild(rightCol.firstChild)
      }
    })

    // remove CTA banner
    await page.evaluate(() => {
      const headerArea = document.querySelector("#headerArea")

      if (headerArea) {
        headerArea.parentElement.removeChild(headerArea)
      }
    })

    // show comments
    const showCommentsButton = await page.$(
      `[data-testid="UFI2CommentsCount/root"]`
    )

    if (showCommentsButton) {
      await showCommentsButton.click()
    }

    // wait for comments to show
    await wait(1000)

    // force show all comments
    const commentViewMenu = await page.$(
      `[data-testid="UFI2ViewOptionsSelector/root"]`
    )
    await commentViewMenu.click()

    /**
     * 1. Most relevant
     * 2. Newest (only this shows all comments)
     * 3. Show all
     */
    const commentViewOptions = await page.$$(
      `[data-testid="UFI2ViewOptionsSelector/menuOption"]`
    )
    await commentViewOptions[1].click()

    // wait for all comments to load
    await wait(1000)

    // keep loading comments until exhausted
    let exhausted = false

    while (!exhausted) {
      const loadMoreCommentButton = await page.$(
        `[data-testid="UFI2CommentsPagerRenderer/pager_depth_0"]`
      )

      if (!loadMoreCommentButton) {
        exhausted = true
        await wait(1000)
        break
      }

      await loadMoreCommentButton.hover()
      await loadMoreCommentButton.click()
      await wait(1000)
    }

    // get all comment rows in the page
    const commentBlocks = await page.$$(
      `[data-testid="UFI2Comment/root_depth_0"]`
    )

    const parseComment = block => {
      return page.evaluate(element => {
        const metadata = {}

        // get comment id
        const dataFt = element.getAttribute("data-ft")
        const { ct: encoded } = JSON.parse(dataFt)
        // use atob cuz browser context
        metadata.id = atob(encoded)
          .split(":")
          .pop()

        /**
         * Get user id
         */
        // should be the avatar aka link to profile page
        const nearestLink = element.querySelector("a")
        const nearestImage = nearestLink.querySelector("img")

        // username happens to be in `alt` of img
        const username = nearestImage.alt
        const dataHovercard = nearestLink.getAttribute("data-hovercard")
        // /ajax/hovercard/user.php?id=foobar"
        const searchParams = new URLSearchParams(dataHovercard.split("?").pop())
        const userId = searchParams.get("id")

        return {
          ...metadata,
          from: {
            id: userId,
            name: username
          }
        }
      }, block)
    }

    const results = await Promise.all(commentBlocks.map(parseComment))

    return results
  } catch (error) {
    console.error(error)

    return []
  } finally {
    await page.close()
  }
}
