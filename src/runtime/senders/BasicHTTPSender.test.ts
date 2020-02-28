import { DefaultPooledBasicHTTPSender } from ".";


describe('HTTP Text Sender Test Suite', () => {

    it('should fetch text request', async () => {
        const sender = new DefaultPooledBasicHTTPSender();
        const { content, type } = await sender.retrieve("http://baidu.com/");
        expect(content.length).toBeTruthy();
        expect(type).toBe("text/html");
    });

});
